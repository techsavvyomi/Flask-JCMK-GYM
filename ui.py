from flask import Blueprint, render_template

ui_blueprint = Blueprint('ui', __name__)

@ui_blueprint.route('/')
def home():
    return render_template('index.html')

@ui_blueprint.route('/competition')
def competition():
    return render_template('competition.html')

@ui_blueprint.route('/competition-log')
def competition_log():
    return render_template('competition-log.html')

@ui_blueprint.route('/normal-log')
def normal_log():
    return render_template('normal-log.html')
