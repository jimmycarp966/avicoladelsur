export class HarnessError extends Error {
  constructor(code, message, remediation = "", details = {}) {
    super(message);
    this.name = "HarnessError";
    this.code = code;
    this.remediation = remediation;
    this.details = details;
  }
}
