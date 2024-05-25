import os
import requests

from dataclasses import dataclass
from xml.etree import ElementTree

@dataclass(repr=True, eq=True)
class OwnCloudFileObject:
    id: str
    file_name: str

class OwnCloudClient:
    """OwnCloudClient is a class that interacts with OwnCloud API to fetch files and their content.
    
    Attributes:
    base_url (str): The base URL of the OwnCloud instance.
    username (str): The username of the user.
    password (str): The password of the user.
    """

    
    def __init__(self, base_url: str, username: str, password: str):
        if base_url.endswith("/"):
            base_url = base_url[:-1]
        self.base_url = base_url
        self.username = username
        self.password = password

    def _dispatch_authenticated_request(self, method: str, url:str, **kwargs) -> requests.Response:
        """Dispatches a request to the OwnCloud API with the provided method and URL."""
        if url.startswith("/"):
            url = url[1:]
        url = f"{self.base_url}/{url}"
        return requests.request(method=method, url=url, auth=(self.username, self.password), **kwargs)
    
    def is_folder(self, file_path):
        response = self._dispatch_authenticated_request(method="PROPFIND", url=f"remote.php/dav/files/{self.username}/{file_path}")
        tree = ElementTree.fromstring(response.content)
        prop = tree.find("{DAV:}prop")
        if prop is None:
            return False
        resourcetype = prop.find("{DAV:}resourcetype")
        if resourcetype is None:
            return False
        return resourcetype.find("{DAV:}collection") is not None
    
    def get_all_files(self) -> list[OwnCloudFileObject | None]:
        response = self._dispatch_authenticated_request(method="PROPFIND", url=f"remote.php/dav/files/{self.username}", headers={"Depth": "1000000000"})
        tree = ElementTree.fromstring(response.content)
        files = []
        for response in tree.findall("{DAV:}response"):
            href = response.find("{DAV:}href").text
            propstat = response.find("{DAV:}propstat")
            if propstat is None:
                continue
            prop = propstat.find("{DAV:}prop")
            if prop is None:
                continue
            if self.is_folder(href):
                continue
            etag = prop.find("{DAV:}getetag")
            if etag is None:
                continue
            href = self._convert_filename_relative_to_root(href)
            oc_obj = OwnCloudFileObject(id=etag.text, file_name=href)
            files.append(oc_obj)
        return files
    
    def _convert_filename_relative_to_root(self, filename):
        if filename.startswith("/"):
            filename = filename[1:]
        return filename.replace(f"remote.php/dav/files/{self.username}/", "")

    def construct_file_url(self, file_path):
        return f"{self.base_url}/apps/files/?dir={os.path.dirname(file_path)}"

    def get_file_content(self, file_path, stream=True):
        response = self._dispatch_authenticated_request(method="GET", url=f"remote.php/dav/files/{self.username}/{file_path}", stream=stream)
        return response.content

if __name__ == "__main__":
    pass