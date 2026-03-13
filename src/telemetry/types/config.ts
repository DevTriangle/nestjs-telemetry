import { Attributes } from '@opentelemetry/api'

export enum TelemetryPropagators {
  JAEGER = 'Jaeger',
  W3C_TRACE_CONTEXT = 'W3CTraceContext',
  W3C_BAGGAGE = 'W3CBaggage',
  B3_SINGLE_HEADER = 'B3Single',
  B3_MULTI_HEADER = 'B3Multi',
}

export interface AdditionalAttributeData {
  /** Name of attribute. */
  name: string

  /** Path to attribute from request. */
  path: string
}

export interface TelemetryConfig {
  /** Service name. */
  serviceName?: string

  /** Environment. */
  environment?: 'production' | 'development'

  /** OTLP traces endpoint URL. */
  otlpTracesEndpoint?: string

  /** Default tracing attributes. */
  defaultAttributes?: Attributes

  /** Additional request attributes. */
  additionalAttributes?: AdditionalAttributeData[]

  /** Paths to ignore. */
  ignorePaths?: string[]

  /** Paths to ignore. */
  propagators?: string[]

  /** Save body on success requests. */
  saveBodyOnSuccess?: boolean

  /** Save body on error requests. */
  saveBodyOnError?: boolean

  /** Error codes to exclude body from requests. */
  excludeBodyOnErrorCodes?: number[]

  /** Body keys to exclude. */
  sensitiveKeys?: RegExp[]
}
