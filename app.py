from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from authlib.integrations.flask_client import OAuth
from datetime import datetime, timezone
#from flask_limiter import Limiter
#from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
import os
import secrets
import bleach
from dotenv import load_dotenv
from flask_mail import Mail, Message
from collections import defaultdict
from datetime import datetime, timedelta



# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Simple engine options that work everywhere
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,  # This is safe and works everywhere
}

# Google OAuth
app.config['GOOGLE_CLIENT_ID'] = os.environ.get('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.environ.get('GOOGLE_CLIENT_SECRET')

# Email configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER')

# Validate required environment variables
required_vars = ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
missing = [var for var in required_vars if not os.environ.get(var)]
if missing:
    print(f"⚠️ Missing critical env vars: {missing}")
    print("The app may not function correctly!")

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login_google'
mail = Mail(app)
oauth = OAuth(app)

# Add CSRF protection (but exclude API endpoints)
csrf = CSRFProtect()
csrf.init_app(app)

# Rate limiting - FIXED syntax
#limiter = Limiter(
#    get_remote_address,
#    app=app,
#    default_limits=["200 per day", "50 per hour"]
#)

# Google OAuth registration
google = oauth.register(
    name='google',
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

app = Flask(__name__,
            static_folder='../static',  # Points to your static folder
            template_folder='../templates')

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

    def __repr__(self):
        return f'<User {self.email}>'


class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    review_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc))

    # Add indexes for better performance
    __table_args__ = (
        db.Index('idx_review_created', 'created_at'),
        db.Index('idx_review_user', 'user_id'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'rating': self.rating,
            'review_text': self.review_text,
            'created_at': self.created_at.strftime('%Y-%m-%d'),
            'author_name': self.author.name,
            'author_avatar': self.author.avatar_url,
        }


class Contact(db.Model):
    __tablename__ = 'contacts'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(200), nullable=False)
    company = db.Column(db.String(200))
    service = db.Column(db.String(200))
    message = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.now(timezone.utc))
    status = db.Column(db.String(50), default='new')

    __table_args__ = (
        db.Index('idx_contact_timestamp', 'timestamp'),
        db.Index('idx_contact_status', 'status'),
    )




# ---------- Flask-Login user loader ----------
@login_manager.user_loader
def load_user(user_id):
    try:
        return User.query.get(int(user_id))
    except Exception as e:
        print(f"Error loading user: {e}")
        return None


# ---------- Helper Functions ----------
def sanitize_text(text, max_length=1000):
    """Sanitize user input to prevent XSS"""
    if not text:
        return ""
    cleaned = bleach.clean(text.strip(), strip=True)
    return cleaned[:max_length]


rate_limits = defaultdict(list)


def is_rate_limited(identifier, max_requests, time_window_seconds):
    """Check if request should be rate limited"""
    now = datetime.now()
    cutoff = now - timedelta(seconds=time_window_seconds)

    # Clean old requests
    rate_limits[identifier] = [t for t in rate_limits[identifier] if t > cutoff]

    # Check limit
    if len(rate_limits[identifier]) >= max_requests:
        return True

    # Add current request
    rate_limits[identifier].append(now)
    return False


# ---------- Routes ----------
@app.route('/')
def home():
    return render_template('index.html')


@app.route('/api/contact', methods=['POST'])
#@limiter.limit("5 per minute")
def contact_form():
    # Limit: 5 submissions per 60 seconds per IP
    client_ip = request.remote_addr
    if is_rate_limited(f"contact_{client_ip}", 5, 60):
        return jsonify({'error': 'Too many messages. Please wait a moment.'}), 429

def contact_form():
    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('name') or not data.get('email'):
            return jsonify({'error': 'Name and email are required'}), 400

        # Sanitize input
        name = sanitize_text(data['name'], 100)
        email = sanitize_text(data['email'], 200)
        company = sanitize_text(data.get('company', ''), 100)
        service = sanitize_text(data.get('service', ''), 100)
        message = sanitize_text(data.get('message', ''), 1000)

        # Validate email format
        import re
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, email):
            return jsonify({'error': 'Invalid email format'}), 400

        # Save to database
        contact = Contact(
            name=name,
            email=email,
            company=company,
            service=service,
            message=message,
            status='new'
        )
        db.session.add(contact)
        db.session.commit()

        # Send email (don't fail if email doesn't work)
        try:
            msg = Message(
                f"New contact from {name}",
                recipients=[os.environ.get('CONTACT_EMAIL', 'egentucampany@gmail.com')]
            )
            msg.body = f"""
Name: {name}
Email: {email}
Company: {company or 'N/A'}
Service: {service or 'N/A'}
Message:
{message or 'No message provided'}

Submitted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            """
            mail.send(msg)
        except Exception as email_error:
            print(f"Email error (non-critical): {email_error}")
            # Still return success since we saved to database

        return jsonify({'success': True, 'message': 'Message received!'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Contact form error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


from sqlalchemy import text  # Add this import at the top of your file


@app.route('/health', methods=['GET'])
def health_check():
    try:
        # Check database connection - FIXED: use text()
        db.session.execute(text('SELECT 1'))
        db_status = 'healthy'
    except Exception as e:
        db_status = f'unhealthy: {str(e)}'

    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'database': db_status
    })


# ---------- Google OAuth Routes ----------
@app.route('/login/google')
def login_google():
    try:
        redirect_uri = url_for('google_callback', _external=True)
        return google.authorize_redirect(redirect_uri)
    except Exception as e:
        print(f"Google login error: {e}")
        return "Login service unavailable", 500


@app.route('/callback/google')
def google_callback():
    try:
        token = google.authorize_access_token()
        userinfo = google.parse_id_token(token)

        if not userinfo:
            return 'Login failed: No user info', 400

        google_id = userinfo.get('sub')
        email = userinfo.get('email')
        name = userinfo.get('name', 'User')
        avatar = userinfo.get('picture')

        if not google_id or not email:
            return 'Login failed: Missing user data', 400

        user = User.query.filter_by(google_id=google_id).first()
        if not user:
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                avatar_url=avatar
            )
            db.session.add(user)
            db.session.commit()

        login_user(user, remember=True)
        next_url = request.args.get('next') or url_for('home')
        return redirect(next_url)

    except Exception as e:
        print(f"OAuth callback error: {e}")
        db.session.rollback()
        return 'Authentication failed. Please try again.', 500


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('home'))


# ---------- Reviews API ----------
# ---------- Reviews API ----------
@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    """Get all reviews - no login required"""
    try:
        reviews = Review.query.order_by(Review.created_at.desc()).limit(50).all()
        return jsonify([r.to_dict() for r in reviews])
    except Exception as e:
        print(f"Error fetching reviews: {e}")
        return jsonify({'error': 'Failed to load reviews'}), 500


@app.route('/api/reviews', methods=['POST'])
@login_required
def submit_review():
    """Submit a new review - login required"""
    try:
        data = request.get_json()
        rating = data.get('rating')
        review_text = data.get('review_text', '').strip()

        # Validate rating
        if not rating or rating not in range(1, 6):
            return jsonify({'error': 'Rating must be 1-5'}), 400

        # Validate review text
        if len(review_text) < 3:
            return jsonify({'error': 'Review must be at least 3 characters'}), 400

        if len(review_text) > 1000:
            return jsonify({'error': 'Review must be less than 1000 characters'}), 400

        # Sanitize review text
        sanitized_text = sanitize_text(review_text, 1000)

        # Check if user has already reviewed
        existing_review = Review.query.filter_by(user_id=current_user.id).first()
        if existing_review:
            return jsonify({'error': 'You can only submit one review'}), 400

        new_review = Review(
            user_id=current_user.id,
            rating=rating,
            review_text=sanitized_text
        )
        db.session.add(new_review)
        db.session.commit()

        return jsonify({'success': True, 'review': new_review.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Review submission error: {e}")
        return jsonify({'error': 'Failed to submit review'}), 500
@app.route('/api/user', methods=['GET'])
@login_required
def get_current_user():
    return jsonify({
        'id': current_user.id,
        'name': current_user.name,
        'email': current_user.email,
        'avatar': current_user.avatar_url
    })


# ---------- Legal Pages ----------
@app.route('/privacy')
def privacy():
    return render_template('privacy.html')


@app.route('/terms')
def terms():
    return render_template('terms.html')


@app.route('/cookies')
def cookies():
    return render_template('cookies.html')


# ---------- Error Handlers ----------
@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('500.html'), 500


@app.errorhandler(429)
def rate_limit_error(error):
    return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429


# ---------- Database and App Initialization ----------
@app.teardown_appcontext
def shutdown_session(exception=None):
    """Close database session after each request"""
    db.session.remove()


# Cache static files
@app.after_request
def add_cache_headers(response):
    if request.path.startswith('/static/'):
        response.cache_control.max_age = 31536000  # 1 year
        response.cache_control.public = True
    return response


# Create tables
with app.app_context():
    try:
        db.create_all()
        print("✅ Database tables ready")
        print(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
    except Exception as e:
        print(f"⚠️ Database initialization error: {e}")
        print("Make sure DATABASE_URL is set correctly")

# For production
app.debug = False

# For local development
if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)