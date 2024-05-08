import { useState } from "react";
import { messageInstance, CloseEyeIcon } from "lowcoder-design";
import { trans } from "i18n";
import {
  FormStyled,
  PasswordLabel,
  StyledSteps
} from "../styledComponents";
import { default as Form } from "antd/es/form";
import { default as Input } from "antd/es/input";
import { default as Tooltip } from "antd/es/tooltip";
import IdSourceApi, { ConfigItem } from "api/idSourceApi";
import { validateResponse } from "api/apiUtils";
import { authConfig, AuthType, ItemType } from "../idSourceConstants";
import _ from "lodash";
import Flex from "antd/es/flex";
import Button from "antd/es/button";
import axios from "axios";

const sourceMappingKeys = [
  'uid',
  'email',
  'username',
  'avatar', 
];

const steps = [
  {
    title: 'Step 1',
    description: 'Issuer endpoint',
  },
  {
    title: 'Step 2',
    description: 'Provider details',
  },
  {
    title: 'Step 3',
    description: 'Mapping',
  },
];

interface OpenIdProvider {
  issuer: string,
  authorization_endpoint: string,
  token_endpoint: string,
  userinfo_endpoint: string,
  jwks_uri?: string,
  scopes_supported: string[],
}

interface ConfigProvider {
  authType: string,
  source: string,
  sourceName: string,
  sourceDescription?: string,
  sourceIcon?: string,
  sourceCategory?: string,
  issuer: string,
  authorizationEndpoint: string,
  tokenEndpoint: string,
  userInfoEndpoint: string,
  jwksUri?: string,
  scope: string,
  sourceMappings: any,
}

type GenericOAuthFormProp = {
  authType: AuthType,
  onSave: () => void;
  onCancel: () => void;
};

function GenericOAuthForm(props: GenericOAuthFormProp) {
  const {
    authType,
    onSave,
    onCancel
  } = props;
  const [form1] = Form.useForm<ConfigProvider>();

  const [saveLoading, setSaveLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [issuerDetails, setIssuerDetails] = useState<ConfigProvider>();

  function saveAuthProvider(values: ConfigItem) {
    setSaveLoading(true);
    const config = {
      ...values,
      enableRegister: true,
    }
    IdSourceApi.saveConfig(config)
      .then((resp) => {
        if (validateResponse(resp)) {
          messageInstance.success(trans("idSource.saveSuccess"));
          onSave();
        }
      })
      .catch((e) => messageInstance.error(e.message))
      .finally(() => {
        setSaveLoading(false);
      });
  }

  const handleStep1Save = () => {
    form1.validateFields().then(async (values) => {
      setSaveLoading(true);
      const { issuer } = values;
      const res = await axios.get<OpenIdProvider>(`${issuer}/.well-known/openid-configuration`);
      setSaveLoading(false);

      if (res.status >= 400) {
        return null;
      }
      setIssuerDetails(() => {
        const issuer = {
          authType: AuthType.Generic,
          source: '',
          sourceName: '',
          issuer: res.data.issuer,
          authorizationEndpoint: res.data.authorization_endpoint,
          tokenEndpoint: res.data.token_endpoint,
          userInfoEndpoint: res.data.userinfo_endpoint,
          jwksUri: res.data.jwks_uri,
          scope: res.data.scopes_supported.join(','),
          sourceMappings: sourceMappingKeys.map(sourceKey => ({
            [sourceKey]: sourceKey,
          }))
        };
        form1.setFieldsValue(issuer);
        return issuer;
      })
      setCurrentStep(currentStep => currentStep + 1);
    })
  }

  const handleStep2Save = () => {
    form1.validateFields().then(values => {
      setIssuerDetails(issuerDetails => ({
        ...issuerDetails,
        ...values,
      }))
      setCurrentStep(currentStep => currentStep + 1);
    })
  }

  const handleStep3Save = () => {
    form1.validateFields().then(values => {
      setIssuerDetails((issuerDetails: any) => {
        const updatedDetails = {
          ...issuerDetails,
          sourceMappings: {
            ...values,
          }
        };
        saveAuthProvider(updatedDetails);
        console.log('save details', updatedDetails);
        return updatedDetails;
      });
    })
  }

  const handleSave = () => {
    if (currentStep === 0) {
      return handleStep1Save();
    }
    if (currentStep === 1) {
      return handleStep2Save();
    }
    if (currentStep === 2) {
      return handleStep3Save();
    }
  }

  function handleCancel() {
    if (currentStep === 0) {
      onCancel();
      return form1.resetFields();
    }
    setCurrentStep(currentStep => currentStep - 1);
  }

  const authConfigForm = authConfig[AuthType.Generic].form;

  return (
    <>
      <StyledSteps
        current={currentStep}
        items={steps}
        style={{marginBottom: '16px'}}
      />
      
      <FormStyled
        form={form1}
        name="generic"
        layout="vertical"
        style={{ maxWidth: '100%' }}
        autoComplete="off"
      >
        {currentStep === 0 && (
          <Form.Item
            name="issuer"
            label="Well-Known / Issuer Endpoint"
            rules={[{ required: true }]}
          >
            <Input
              placeholder={trans("idSource.formPlaceholder", {
                label: 'Issuer Endpoint',
              })}
            />
          </Form.Item>
        )}
        {currentStep === 1 && Object.entries(authConfigForm).map(([key, value]) => {
          const valueObject = _.isObject(value) ? (value as ItemType) : false;
          const required = true;
          const label = valueObject ? valueObject.label : value as string;
          const tip = valueObject && valueObject.tip;
          const isPassword = valueObject && valueObject.isPassword;
          return (
            <div key={key}>
              <Form.Item
                key={key}
                name={key}
                rules={[
                  {
                    required,
                    message: trans("idSource.formPlaceholder", {
                      label,
                    }),
                  },
                ]}
                label={
                  isPassword ? (
                    <PasswordLabel>
                      <span>{label}:</span>
                      <CloseEyeIcon />
                    </PasswordLabel>
                  ) : (
                    <Tooltip title={tip}>
                      <span className={tip ? "has-tip" : ""}>{label}</span>:
                    </Tooltip>
                  )
                }
              >
                {isPassword ? (
                  <Input
                    type={"password"}
                    placeholder={trans("idSource.encryptedServer")}
                    autoComplete={"one-time-code"}
                  />
                ) : (
                  <Input
                    placeholder={trans("idSource.formPlaceholder", {
                      label,
                    })}
                  />
                )}
              </Form.Item>
            </div>
          );
        })}
        {currentStep === 2 && sourceMappingKeys.map(sourceKey => (
          <Flex gap="10px" align="start" key={sourceKey} >
            <Input
              readOnly
              disabled
              value={sourceKey}
              style={{flex: 1}}
            />
            <span> &#8594; </span>
            <Form.Item
              name={sourceKey}
              rules={[{ required: true }]}
              style={{flex: 1}}
            >
              <Input
                placeholder={trans("idSource.formPlaceholder", {
                  label: sourceKey,
                })}
              />
            </Form.Item>
          </Flex>
        ))}
        <Flex justify="end" gap={'8px'}>
          <Button
            type="default"
            style={{margin: 0}}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            style={{margin: 0}}
            onClick={handleSave}
            loading={saveLoading}
          >
            Save
          </Button>
        </Flex>
      </FormStyled>
    </>
  );
}

export default GenericOAuthForm;
