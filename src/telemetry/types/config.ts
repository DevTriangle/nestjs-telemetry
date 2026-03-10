import { Attributes } from '@opentelemetry/api'

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
}
