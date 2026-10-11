// Services throw ServiceError on rule denials and bad input; the API turns it into {error:{code,message}}.
import type { RuleResult } from "@/lib/domain/result";

export class ServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/** Throws the denial of a domain rule check as a ServiceError (403 by default: the rules are permissions). */
export function ensure(result: RuleResult, httpStatus = 403): void {
  if (!result.ok) throw new ServiceError(result.code, result.message, httpStatus);
}

export const notFound = (what: string, id: string) => new ServiceError("not_found", `${what} ${id} was not found`, 404);

export const conflict = (code: string, message: string) => new ServiceError(code, message, 409);

export const invalid = (code: string, message: string) => new ServiceError(code, message, 422);
