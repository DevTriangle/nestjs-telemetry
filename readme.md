# NestJS Telemetry Module

Telemetry Module for NestJS.

## Getting started

### Installation

```
npm install --save nestjs-telemetry
```

### Module setup

```
@Module({
    imports: [
        TelemetryModule.forRoot({
            serviceName: 'gateway',
            otlpTracesEndpoint: 'http://localhost:4318/v1/traces',
            additionalAttributes: [{ name: 'user_id', path: 'user.user_id' }],
            saveBodyOnError: true,
            excludeBodyOnStatusCodes: [HttpStatus.BAD_REQUEST, HttpStatus.FORBIDDEN, HttpStatus. UNAUTHORIZED],
        })
    ]
})
export class AppModule {}
```

The async way is to use TelemetryModule.forRootAsync

```
@Module({
    imports: [
        TelemetryModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                serviceName: config.get('service_name'),
                otlpTracesEndpoint: config.get('otlp_traces_endpoint'),
                additionalAttributes: [{ name: 'user_id', path: 'user.user_id' }],
                saveBodyOnError: true,
                excludeBodyOnStatusCodes: [HttpStatus.BAD_REQUEST, HttpStatus.FORBIDDEN, HttpStatus.UNAUTHORIZED],
            })
        })
    ]
})
export class AppModule {}
```

### TelemetryModule options

```
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

    /** Status codes to exclude body from requests. */
    excludeBodyOnStatusCodes?: number[]

    /** Body keys to exclude. */
    sensitiveKeys?: RegExp[]
}
```
