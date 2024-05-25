from danswer.connectors.interfaces import LoadConnector
from danswer.connectors.interfaces import PollConnector
from danswer.connectors.owncloud.owncloud_client import OwnCloudClient

class OwnCloudConnector(LoadConnector, PollConnector):
    
    def __init__(self) -> None:
        self.client = OwnCloudClient()
        super().__init__()
    
    

