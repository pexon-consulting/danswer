import io
from datetime import datetime, timezone
from typing import Any
from danswer.connectors.interfaces import LoadConnector
from danswer.connectors.interfaces import PollConnector
from danswer.connectors.owncloud.owncloud_client import OwnCloudClient
from danswer.connectors.owncloud.owncloud_client import OwnCloudFileObject
from danswer.configs.app_configs import INDEX_BATCH_SIZE
from danswer.configs.constants import DocumentSource
from danswer.connectors.interfaces import GenerateDocumentsOutput
from danswer.connectors.interfaces import LoadConnector
from danswer.connectors.interfaces import PollConnector
from danswer.connectors.interfaces import SecondsSinceUnixEpoch
from danswer.connectors.models import BasicExpertInfo
from danswer.connectors.models import ConnectorMissingCredentialError
from danswer.connectors.models import Document
from danswer.connectors.models import Section
from danswer.file_processing.extract_file_text import docx_to_text
from danswer.file_processing.extract_file_text import file_io_to_text
from danswer.file_processing.extract_file_text import is_text_file_extension
from danswer.file_processing.extract_file_text import pdf_to_text
from danswer.file_processing.extract_file_text import pptx_to_text
from danswer.file_processing.extract_file_text import xlsx_to_text
from danswer.utils.logger import setup_logger


logger = setup_logger()


class OwnCloudConnector(LoadConnector, PollConnector):
    
    oc_client: OwnCloudClient | None = None

    def __init__(self) -> None:
        pass

    def load_credentials(self, credentials: dict[str, Any]) -> dict[str, Any] | None:
        self.base_url = credentials.get("base_url")
        username = credentials.get("username")
        password = credentials.get("password")
        self.oc_client = OwnCloudClient(base_url=self.base_url, username=username, password=password)

    def get_all_files(self):
        return self.oc_client.get_all_files()

    def get_file_content(self, file_path, stream=True) -> io.BytesIO:
        return io.BytesIO(self.oc_client.get_file_content(file_path, stream=stream))

    def convert_file_to_document(self, file: OwnCloudFileObject) -> Document:
        file_ext = file.file_name.split(".")[-1]
        text = None
        if file_ext == "docx":
            text = docx_to_text(self.get_file_content(file.file_name))
        elif file_ext == "pdf":
            text = pdf_to_text(self.get_file_content(file.file_name))
        elif file_ext == "pptx":
            text = pptx_to_text(self.get_file_content(file.file_name))
        elif file_ext == "xlsx":
            text = xlsx_to_text(self.get_file_content(file.file_name))
        elif is_text_file_extension(file.file_name):
            text = file_io_to_text(self.get_file_content(file.file_name))
        if text:
            return Document(
                id=file.id,
                source=DocumentSource.OWNCLOUD,
                title=file.file_name,
                text=text,
                semantic_identifier=file.file_name,
                sections=[Section(link=self.oc_client.construct_file_url(file.file_name), text=text)],
                primary_owners=[BasicExpertInfo(
                    display_name=self.oc_client.username
                )],
                metadata={},
            )

    def _full_pipeline(self, start: datetime, end: datetime) -> GenerateDocumentsOutput:
        logger.info("Getting list of all files")
        all_files = self.get_all_files()
        logger.info(f"Found {len(all_files)} files")
        doc_batch: list[Document] = []
        for file in all_files:
            logger.info(f"Processing file: {file.file_name}")
            try:
                document = self.convert_file_to_document(file)
                if document:
                    doc_batch.append(document)
            except Exception as e:
                logger.error(f"Error processing file: {file}")
                logger.error(e)
            if len(doc_batch) >= INDEX_BATCH_SIZE:
                yield doc_batch
                doc_batch = []
        yield doc_batch
        
    
    def load_from_state(self) -> GenerateDocumentsOutput:
        if not self.oc_client:
            raise ConnectorMissingCredentialError("OwnCloud")
        return self._full_pipeline(datetime.min, datetime.max)
    
    def poll_source(self, start: SecondsSinceUnixEpoch, end: SecondsSinceUnixEpoch) -> GenerateDocumentsOutput:
        if not self.oc_client:
            raise ConnectorMissingCredentialError("OwnCloud")
        start_datetime = datetime.fromtimestamp(start)
        start_datetime = start_datetime.replace(tzinfo=timezone.utc)
        end_datetime = datetime.fromtimestamp(end)
        end_datetime = end_datetime.replace(tzinfo=timezone.utc)
        return self._full_pipeline(start_datetime, end_datetime)