"""
handles communication with mpv's unix socket
"""

import socket
import json

class MPVSocket:
    def __init__(self, socket_path: str):
        self.socket = socket_path
    
    def is_on(self) -> bool:
        """
        returns if an mpv socket is open
        """
        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            client.connect(self.socket)
            return True
        except (FileNotFoundError, ConnectionRefusedError, socket.error):
            return False

    def send_command(self, command: str, args: [str] = None):
        payload = {"command": [command]}
        if args:
            payload["command"].extend(args)
        payload = json.dumps(payload).encode("utf-8") + b"\n"
        
        if not self.is_on():
            return -1

        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.connect(self.socket)
            client.sendall(payload)
            response = client.recv(4096)
            client.close()
            return json.loads(response.decode("utf-8"))

    def get_current_file(self):
        """
        returns the current file being played (or None)
        """
        resp = self.send_command("get_property", ["path"])
        if resp == -1 or resp.get("error") != "success":
            return None
        return resp.get("data")

    def get_pause_status(self):
        """
        returns if the current file is paused or played (or None)
        """
        response = self.send_command("get_property", ["pause"])
    
        if response == -1:
            return None
        else:
            return response.get('data')

    def set_pause(self, pause: bool):
        """
        sets the pause to true or false
        """
        self.send_command("set_property", ["pause", pause])

    def get_progress(self):
        """
        returns the current progress of the current file being played
        """
        response = self.send_command("get_property", ["playback-time"])
        return response['data']

    def quit_instance(self):
        """
        quits current mpv instance
        """
        self.send_command("quit")