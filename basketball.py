import requests
import datetime
import time
import pytz # type: ignore

def check_available_basketball_sessions(activity_id, auth_token, sports_hall_str):
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

    try:
            
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
    except:
        return ""
