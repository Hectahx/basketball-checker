import requests
import datetime
import time
import os
import json
import pytz
from dotenv import load_dotenv
load_dotenv()

def send_pushover_notification(message):
    url = 'https://api.pushover.net/1/messages.json'
    user_key = os.getenv('pushover_user_key')
    api_token = os.getenv('pushover_api_token')
    data = {
        'token': api_token,  # Your Pushover app token
        'user': user_key,    # Your Pushover user key
        'title': "Basketball Sessions",
        'message': message
    }
    requests.post(url, data=data)

def get_jwt_token():
    user = os.getenv("user")
    pw = os.getenv("pw")

    url = "https://sportaston.gs-signature.cloud/AWS/api/token"
    headers = {
        'accept': 'application/json',
        'authenticationkey': 'M0bi1eProB00king$',
        'content-type': 'application/json',
        'accept-language': 'en-GB;q=1.0, ar-GB;q=0.9',
        'user-agent': 'iPhone',
        'user' : str(user),
        'pw' : str(pw)
    }

    params = {
        'locale': 'en_GB'
    }

    response = requests.get(url, headers=headers, params=params)
    data = response.json()
    jwt_token = data['jwtToken']
    return jwt_token

def check_available_sessions(activity_id, auth_token, sports_hall_str):

    available_sessions = ""

    url = 'https://sportaston.gs-signature.cloud/AWS/api/activity/availability'
    headers = {
        'accept': 'application/json',
        'authenticationkey': 'M0bi1eProB00king$',
        'content-type': 'application/json',
        'accept-language': 'en-GB;q=1.0, ar-GB;q=0.9',
        'user-agent': 'iPhone',
        'authorisation': f'Bearer {auth_token}'  # Pass the auth_token dynamically
    }
    
    # Get the current UTC time and the time 10 days from now in epoch format
    current_time = int(time.time())  # Current time in epoch (fromUTC)
    time_in_10_days = current_time + 10 * 24 * 60 * 60  # Add 10 days in seconds (toUTC)

    params = {
        'toUTC': time_in_10_days,
        'fromUTC': current_time,
        'activityId': activity_id,
        'locale': 'en_GB'
    }
    
    response = requests.get(url, headers=headers, params=params)
    data = response.json()

    # Define time boundaries for the day check
    target_day = 5  # You mentioned this should be Monday (0 is Monday, 6 is Sunday)
    start_time = 12 * 3600  # 12 PM in seconds (since midnight)
    end_time = 19 * 3600  # 7 PM in seconds (since midnight)

    # Set the timezone for UK (handles BST and GMT)
    uk_timezone = pytz.timezone('Europe/London')

    for item in data['bookableItems']:
        for slot in item['slots']:
            # Convert the slot time from UTC to UK time
            slot_time_utc = datetime.datetime.fromtimestamp(slot['sUTC']).replace(tzinfo=pytz.utc)
            slot_time_uk = slot_time_utc.astimezone(uk_timezone)
            
            # Check if the slot is on the specified day (Monday)
            if slot_time_uk.weekday() == target_day:
                slot_seconds = slot_time_uk.hour * 3600 + slot_time_uk.minute * 60
                # Check if the time is between 12 PM and 7 PM
                if start_time <= slot_seconds <= end_time:
                    # Check if the slot is available
                    if slot['p'] != "" and slot['s'] == 1:
                        message = f"{slot_time_uk.strftime('%A')} {slot_time_uk.strftime('%-d')}{'th' if 4<=slot_time_uk.day<=20 or 24<=slot_time_uk.day<=30 else {1: 'st', 2: 'nd', 3: 'rd'}.get(slot_time_uk.day % 10, 'th')} {slot_time_uk.strftime('%B %Y')} at {slot_time_uk.strftime('%H:%M')} in {sports_hall_str}"
                        available_sessions += message + "\n"
    return available_sessions

def check_booking():
    SHALL1 = "WSCACT0009"
    SHALL2 = "WSCACT0010"

    auth_token = get_jwt_token()
    message = ""
    message +=check_available_sessions(SHALL1, auth_token, "Sports Hall 1")
    message +=check_available_sessions(SHALL2, auth_token, "Sports Hall 2")
    if message == "":
        message = "There are no available sessions"
    else:
        message = "These are the availble sessions\n" + message
    send_pushover_notification(message)

check_booking()
