from flask import Blueprint, render_template

ui_bp = Blueprint('ui', __name__)

@ui_bp.route('/')
def home():
    return render_template('index.html')

@ui_bp.route('/competition')
def competition():
    return render_template('competition.html')

@ui_bp.route('/competition-log')
def competition_log():
    return render_template('competition-log.html')

@ui_bp.route('/normal-log')
def normal_log():
    return render_template('normal-log.html')
