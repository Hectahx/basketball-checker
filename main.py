import requests
import datetime
import time
import pytz # type: ignore
from func import *
from badminton import *
from basketball import *

def check_basketball_booking():
    SHALL1 = "WSCACT0009"
    SHALL2 = "WSCACT0010"

    auth_token = get_jwt_token()
    message = ""
    message +=check_available_basketball_sessions(SHALL1, auth_token, "Sports Hall 1") # type: ignore
    message +=check_available_basketball_sessions(SHALL2, auth_token, "Sports Hall 2")
    if message == "":
        message = "There are no available sessions"
    else:
        message = "These are the available sessions between 12pm and 7pm:\n\n" + message
    send_pushover_notification(message, "Basketball Sessions")

def check_badminton_booking():
    SHALL1 = "WSCACT0001"
    SHALL2 = "WSCACT0004"
    auth_token = get_jwt_token()
    message = ""
    message += check_available_badminton_sessions(SHALL1, auth_token, "Sports Hall 1")
    message += check_available_badminton_sessions(SHALL2, auth_token, "Sports Hall 2")
    if message == "":
        message = "There are no available sessions"
    else:
        message = "These are the availble sessions between 5pm and Close:\n\n" + message
    send_pushover_notification(message, "Badminton Sessions")

check_badminton_booking()
check_basketball_booking()
