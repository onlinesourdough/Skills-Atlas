const stages = [
  "callback-url",
  "callback-hash",
  "callback-state-count",
  "callback-code-count",
  "callback-issuer",
  "callback-unexpected-parameter",
  "callback-browser",
  "callback-attempt",
  "callback-expiry",
  "callback-unseal",
  "callback-exchange",
  "callback-access",
  "callback-session",
  "exchange-validation",
  "exchange-request",
  "exchange-body",
  "exchange-response",
  "exchange-token-policy",
] as const;

export type OAuthStage = (typeof stages)[number];

const parameterCategories = [
  "iss",
  "scope",
  "installation_id",
  "setup_action",
  "authuser",
  "prompt",
  "error",
  "error_description",
  "error_uri",
] as const;

// Never accept an error object, request, response body, URL or credential here.
export function oauthDiagnostic(
  stage: OAuthStage,
  status?: number,
  oauthError?: string,
  unexpectedNames?: readonly string[],
): void {
  if (!stages.includes(stage)) return;
  console.warn(
    JSON.stringify({
      event: "atlas-oauth-failure",
      stage,
      ...(stage === "callback-unexpected-parameter" && unexpectedNames
        ? {
            parameterCategories: [
              ...parameterCategories.filter((category) => unexpectedNames.includes(category)),
              ...(unexpectedNames.some(
                (name) => !parameterCategories.some((category) => category === name),
              )
                ? ["unknown"]
                : []),
            ],
          }
        : {}),
      ...([
        "invalid_request",
        "unauthorized_client",
        "access_denied",
        "unsupported_response_type",
        "invalid_scope",
        "server_error",
        "temporarily_unavailable",
      ].includes(oauthError ?? "")
        ? { oauthError }
        : {}),
      ...(Number.isInteger(status) && status! >= 100 && status! <= 599 ? { status } : {}),
    }),
  );
}
