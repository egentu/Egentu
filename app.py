from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from authlib.integrations.flask_client import OAuth
from datetime import datetime, timezone
import os
import json
import secrets
from dotenv import load_dotenv
from flask_mail import Mail, Message

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['GOOGLE_CLIENT_ID'] = os.environ.get('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.environ.get('GOOGLE_CLIENT_SECRET')
# Email configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True') == 'True'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER')
mail = Mail(app)

# Check required environment variables
if not app.config['SQLALCHEMY_DATABASE_URI']:
    raise ValueError("DATABASE_URL environment variable not set")
if not app.config['GOOGLE_CLIENT_ID'] or not app.config['GOOGLE_CLIENT_SECRET']:
    print("⚠️ Warning: Google OAuth credentials not set. Login will not work.")

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login_google'
oauth = OAuth(app)

# Google OAuth registration
google = oauth.register(
    name='google',
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)


# ---------- Database Models ----------
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    google_id = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    avatar_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc))

    reviews = db.relationship('Review', backref='author', lazy=True)


class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1-5
    review_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'rating': self.rating,
            'review_text': self.review_text,
            'created_at': self.created_at.strftime('%Y-%m-%d'),
            'author_name': self.author.name,
            'author_avatar': self.author.avatar_url,
        }


# ---------- Contact Storage (JSON file, unchanged) ----------
CONTACTS_FILE = 'contacts.json'
contacts = []


def load_contacts():
    global contacts
    if os.path.exists(CONTACTS_FILE):
        with open(CONTACTS_FILE, 'r') as f:
            contacts = json.load(f)


def save_contacts():
    with open(CONTACTS_FILE, 'w') as f:
        json.dump(contacts, f, indent=2)


load_contacts()


# ---------- Flask-Login user loader ----------
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ---------- Routes ----------
@app.route('/')
def home():
    return render_template('index.html')


@app.route('/api/contact', methods=['POST'])
def contact_form():
    try:
        data = request.get_json()
        if not data.get('name') or not data.get('email'):
            return jsonify({'error': 'Name and email are required'}), 400

        # Save to JSON (optional)
        contact = {
            'id': len(contacts) + 1,
            'name': data['name'],
            'email': data['email'],
            'company': data.get('company', ''),
            'service': data.get('service', ''),
            'message': data.get('message', ''),
            'timestamp': datetime.now().isoformat(),
            'status': 'new'
        }
        contacts.append(contact)
        save_contacts()

        # Send email to you
        msg = Message(f"New contact from {data['name']}",
                      recipients=['egentucampany@gmail.com'])  # your email
        msg.body = f"""
Name: {data['name']}
Email: {data['email']}
Company: {data.get('company', 'N/A')}
Service: {data.get('service', 'N/A')}
Message:
{data.get('message', '')}

Submitted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        """
        mail.send(msg)

        return jsonify({'success': True, 'message': 'Message received! Email sent.'}), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})


# ---------- Google OAuth Routes ----------
@app.route('/login/google')
def login_google():
    redirect_uri = url_for('google_callback', _external=True)
    return google.authorize_redirect(redirect_uri)


@app.route('/callback/google')
def google_callback():
    token = google.authorize_access_token()
    userinfo = google.parse_id_token(token)
    if not userinfo:
        return 'Login failed', 400

    google_id = userinfo['sub']
    email = userinfo['email']
    name = userinfo.get('name', '')
    avatar = userinfo.get('picture')

    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        user = User(google_id=google_id, email=email, name=name, avatar_url=avatar)
        db.session.add(user)
        db.session.commit()

    login_user(user, remember=True)
    next_url = request.args.get('next') or url_for('home')
    return redirect(next_url)


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('home'))


# ---------- Reviews API ----------
@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    """Return all reviews (public)"""
    reviews = Review.query.order_by(Review.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reviews])


@app.route('/api/reviews', methods=['POST'])
@login_required
def submit_review():
    """Submit a review (login required)"""
    data = request.get_json()
    rating = data.get('rating')
    review_text = data.get('review_text', '').strip()

    if not rating or rating not in range(1, 6):
        return jsonify({'error': 'Rating must be 1-5'}), 400
    if len(review_text) < 3:
        return jsonify({'error': 'Review must be at least 3 characters'}), 400

    new_review = Review(
        user_id=current_user.id,
        rating=rating,
        review_text=review_text
    )
    db.session.add(new_review)
    db.session.commit()

    return jsonify({'success': True, 'review': new_review.to_dict()}), 201


@app.route('/api/user', methods=['GET'])
@login_required
def get_current_user():
    """Return current logged-in user info"""
    return jsonify({
        'id': current_user.id,
        'name': current_user.name,
        'email': current_user.email,
        'avatar': current_user.avatar_url
    })

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/cookies')
def cookies():
    return render_template('cookies.html')


# ---------- Create database tables (run on first start) ----------
with app.app_context():
    db.create_all()
    print("✅ Database tables ready (Neon PostgreSQL)")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)