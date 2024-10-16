import requests
import os
from dotenv import load_dotenv #type: ignore
load_dotenv()

def send_pushover_notification(message, title):
    url = 'https://api.pushover.net/1/messages.json'
    user_key = os.getenv('pushover_user_key')
    api_token = os.getenv('pushover_api_token')
    data = {
        'token': api_token,  # Your Pushover app token
        'user': user_key,    # Your Pushover user key
        'title': title,
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