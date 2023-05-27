import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from flask_cors import CORS


# If modifying these scopes, delete token.json.
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
# The file token.json stores the user's access and refresh tokens, and is
# created automatically when the authorization flow completes for the first
# time.
TOKEN_PATH = os.path.join(os.getcwd(), 'token.json')
CREDENTIALS_PATH = os.path.join(os.getcwd(), 'credentials.json')


# Food Menu list
foodList = []


# Google Calendar API
def load_saved_credentials_if_exist():
    try:
        with open(TOKEN_PATH, 'r') as file:
            credentials_data = json.load(file)
            credentials = Credentials.from_authorized_user_info(credentials_data)
            return credentials
    except FileNotFoundError:
        return None


def save_credentials(client):
    with open(CREDENTIALS_PATH, 'r') as file:
        keys = json.load(file)
        key = keys.get('installed') or keys.get('web')
        payload = {
            'type': 'authorized_user',
            'client_id': key['client_id'],
            'client_secret': key['client_secret'],
            'refresh_token': client.credentials.refresh_token
        }
        with open(TOKEN_PATH, 'w') as token_file:
            json.dump(payload, token_file)


def authorize():
    client = load_saved_credentials_if_exist()
    if client:
        return client
    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
    client = flow.run_local_server()
    save_credentials(client)
    return client


def list_events(auth):
    # Settings:
    calendar = build('calendar', 'v3', credentials=auth)

    s_calendarId = "primary"
    s_timeMin = datetime.utcnow().isoformat() + 'Z'
    s_maxResult = 5
    s_singleEvents = True
    s_orderBy = "startTime"

    # Getting events
    g_event = calendar.events().list(
        calendarId=s_calendarId,
        timeMin=s_timeMin,
        maxResults=s_maxResult,
        singleEvents=s_singleEvents,
        orderBy=s_orderBy
    ).execute()

    # DEBUGING: Events
    events = g_event.get('items', [])
    if not events:
        print('No upcoming events found.')
        # Return Event None
        return False
    else:
        print('Upcoming 10 events:')
        e = {}

        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))
            print(f"{start} - {event['summary']}")
            # Adding to "e"
            e[event['summary'] + start] = {
                'name': event['summary'],
                'start': start,
                'end': end,
                'user': event['creator']['email'],
                'description': event['description']
            }

        # Returning "e"
        return e


# Website and Server communication:
app = Flask(__name__)
CORS(app)


# Request for calendar info from base-website
@app.route('/calendar', methods=['POST'])
def get_calendar():
    data = request.json
    # Sending data to website
    auth = authorize()
    events = list_events(auth)
    if events:
        # Fixing calendar info into data and sending it to server
        response_data = {
            'calendar': events,
            'food': foodList
        }
        return jsonify(response_data)
    else:
        return jsonify({'calendar': False, 'food': foodList})


# Request for adding food to base-website
@app.route('/food_add', methods=['POST'])
def add_food():
    data = request.json['food']
    # Getting req data of food to add
    foodList.append(data)
    # DEBUG
    print(foodList)
    return 'Food added successfully'


# Request for getting food from base-website
@app.route('/food_get', methods=['POST'])
def get_food():
    # Getting food list
    return jsonify(foodList)


# Request for removing food from base-website (food list)
@app.route('/food_remove', methods=['POST'])
def remove_food():
    # Getting food to remove
    data = request.json['food']
    # Removing food
    for food in foodList:
        if food == data:
            foodList.remove(food)
            break
    # Debug
    print("Removing Food:", data, "from foodList[]")
    print(foodList)
    return 'Food removed successfully'


if __name__ == '__main__':
    app.run(port=3000)
