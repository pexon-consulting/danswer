"use client";

import * as Yup from "yup";
import { OwnCloudIcon, TrashIcon } from "@/components/icons/icons";
import { TextFormField } from "@/components/admin/connectors/Field";
import { HealthCheckBanner } from "@/components/health/healthcheck";
import { CredentialForm } from "@/components/admin/connectors/CredentialForm";
import {
  OwnCloudCredentialJson,
  OwnCloudConfig,
  ConnectorIndexingStatus,
  Credential,
} from "@/lib/types";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { LoadingAnimation } from "@/components/Loading";
import { adminDeleteCredential, linkCredential } from "@/lib/credential";
import { ConnectorForm } from "@/components/admin/connectors/ConnectorForm";
import { ConnectorsTable } from "@/components/admin/connectors/table/ConnectorsTable";
import { usePopup } from "@/components/admin/connectors/Popup";
import { usePublicCredentials } from "@/lib/hooks";
import { AdminPageTitle } from "@/components/admin/Title";
import { Card, Text, Title } from "@tremor/react";

const Main = () => {
  const { popup, setPopup } = usePopup();

  const { mutate } = useSWRConfig();
  const {
    data: connectorIndexingStatuses,
    isLoading: isConnectorIndexingStatusesLoading,
    error: isConnectorIndexingStatusesError,
  } = useSWR<ConnectorIndexingStatus<any, any>[]>(
    "/api/manage/admin/connector/indexing-status",
    fetcher
  );
  const {
    data: credentialsData,
    isLoading: isCredentialsLoading,
    error: isCredentialsError,
    refreshCredentials,
  } = usePublicCredentials();

  if (
    (!connectorIndexingStatuses && isConnectorIndexingStatusesLoading) ||
    (!credentialsData && isCredentialsLoading)
  ) {
    return <LoadingAnimation text="Loading" />;
  }

  if (isConnectorIndexingStatusesError || !connectorIndexingStatuses) {
    return <div>Failed to load connectors</div>;
  }

  if (isCredentialsError || !credentialsData) {
    return <div>Failed to load credentials</div>;
  }

  const owncloudConnectorIndexingStatuses: ConnectorIndexingStatus<
    OwnCloudConfig,
    OwnCloudCredentialJson
  >[] = connectorIndexingStatuses.filter(
    (connectorIndexingStatus) =>
      connectorIndexingStatus.connector.source === "owncloud"
  );
  const owncloudCredential: Credential<OwnCloudCredentialJson> | undefined = 
  credentialsData.filter(
    (credential) => credential.credential_json?.password
  )[0];

  return (
    <>
      {popup}
      <Title className="mb-2 mt-6 ml-auto mr-auto">
        Provide your Owncloud Details
      </Title>

      {owncloudCredential ? (
        <>
          <div className="flex mb-1 text-sm">
            <p className="my-auto">Username: </p>
            <p className="ml-1 italic my-auto max-w-md">
              {owncloudCredential.credential_json?.username} &nbsp;
            </p>
            <p className="my-auto">Password: </p>
            <p className="ml-1 italic my-auto max-w-md">
              {owncloudCredential.credential_json?.password} &nbsp;
            </p>
            <button
              className="ml-1 hover:bg-hover rounded p-1"
              onClick={async () => {
                if (owncloudConnectorIndexingStatuses.length > 0) {
                  setPopup({
                    type: "error",
                    message:
                      "Must delete all connectors before deleting credentials",
                  });
                  return;
                }
                await adminDeleteCredential(owncloudCredential.id);
                refreshCredentials();
              }}
            >
              <TrashIcon />
            </button>
          </div>
        </>
      ) : (
        <>
          <Text>
            Fill following details about your OwnCloud Account
          </Text>
          <Card className="mt-4 mb-4">
            <CredentialForm<OwnCloudCredentialJson>
              formBody={
                <>
                  <TextFormField
                    name="base_url"
                    label="OwnCloud base url (https://oc.mycompany.com):"
                  />
                  <TextFormField
                    name="username"
                    label="OwnCloud Username:"
                  />
                  <TextFormField
                    name="password"
                    label="Client Secret:"
                    type="password"
                  />
                </>
              }
              validationSchema={Yup.object().shape({
                base_url: Yup.string().required(
                  "Please enter the base url for your OwnCloud instance"
                ),
                username: Yup.string().required(
                  "Please enter your client ID."
                ),
                password: Yup.string().required(
                  "Please enter your client Secret."
                ),
              })}
              initialValues={{
                base_url: "",
                username: "",
                password: "",
              }}
              onSubmit={(isSuccess) => {
                if (isSuccess) {
                  refreshCredentials();
                  mutate("/api/manage/admin/connector/indexing-status");
                }
              }}
            />
          </Card>
        </>
      )}

      {owncloudConnectorIndexingStatuses.length > 0 && (
        <>
          <Title className="mb-2 mt-6 ml-auto mr-auto">
            OwnCloud indexing status
          </Title>
          <Text className="mb-2">
            The latest file changes are fetched every 10 minutes.
          </Text>
          <div className="mb-2">
            <ConnectorsTable<OwnCloudConfig, OwnCloudCredentialJson>
              connectorIndexingStatuses={owncloudConnectorIndexingStatuses}
              liveCredential={owncloudCredential}
              getCredential={(credential) => {
                return (
                  <div>
                    <p>{credential.credential_json.username}</p>
                    &nbsp;
                    <p>{credential.credential_json.password}</p>
                    &nbsp;
                    <p>{credential.credential_json.base_url}</p>
                  </div>
                );
              }}
              onCredentialLink={async (connectorId) => {
                if (owncloudCredential) {
                  await linkCredential(connectorId, owncloudCredential.id);
                  mutate("/api/manage/admin/connector/indexing-status");
                }
              }}
              onUpdate={() =>
                mutate("/api/manage/admin/connector/indexing-status")
              }
            />
          </div>
        </>
      )}

      {owncloudCredential && owncloudConnectorIndexingStatuses.length === 0 && (
        <>
          <Card className="mt-4">
            <h2 className="font-bold mb-3">Create Connection</h2>
            <p className="text-sm mb-4">
              Press connect below to start the connection to your OwnCloud
              instance.
            </p>
            <ConnectorForm<OwnCloudConfig>
              nameBuilder={(values) => `OwnCloudConnector`}
              ccPairNameBuilder={(values) => `OwnCloudConnector`}
              source="owncloud"
              inputType="poll"
              formBody={<></>}
              validationSchema={Yup.object().shape({})} // no fields to validate
              initialValues={{}}
              refreshFreq={10 * 60} // 10 minutes
              credentialId={owncloudCredential.id}
            />
          </Card>
        </>
      )}

      {!owncloudCredential && (
        <>
          <Text className="mb-4">
            Please provide your Account details in Step 1 first! Once done with
            that, you&apos;ll be able to start the connection then see indexing
            status.
          </Text>
        </>
      )}
    </>
  );
};

export default function Page() {
  return (
    <div className="mx-auto container">
      <div className="mb-4">
        <HealthCheckBanner />
      </div>

      <AdminPageTitle icon={<OwnCloudIcon size={32} />} title="OwnCloud" />

      <Main />
    </div>
  );
}
