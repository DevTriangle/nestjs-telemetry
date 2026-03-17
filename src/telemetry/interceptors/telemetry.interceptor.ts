import { CallHandler, ExecutionContext, HttpStatus, Inject, Injectable, NestInterceptor } from '@nestjs/common'
import { TelemetryService } from '../telemetry.service'
import { Observable, tap } from 'rxjs'
import { Attributes, propagation, SpanStatusCode, trace } from '@opentelemetry/api'
import { getNested } from '../../utils/get-nested'
import { TelemetryConfig } from '../types/config'

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private defaultSensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /credit.?card/i,
    /ssn/i,
    /social.?security/i,
    /authorization/i,
    /api[_-]?key/i,
  ]

  constructor(
    @Inject(TelemetryService)
    private readonly telemetryService: TelemetryService,
  ) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<any> {
    const req = this.getRequest(executionContext)
    const res = this.getResponse(executionContext)

    const extractedContext = this.telemetryService.extractContext(req.headers)
    const config = this.telemetryService.getConfig()

    const spanName = `${req.method as string}:${req.url as string}`
    const additionalAttributes = this.extractAdditionalAttributes(req, config)

    const span = this.telemetryService.startSpan(
      spanName,
      {
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          ...additionalAttributes,
        },
      },
      extractedContext,
    )

    const ctx = trace.setSpan(extractedContext, span)

    if (res) {
      const carrier = {}
      propagation.inject(ctx, carrier)
      Object.entries(carrier).forEach(([key, value]) => {
        res.setHeader(key, value)
      })
    }

    const excludeBodyCodes = config.excludeBodyOnStatusCodes ?? []

    return next.handle().pipe(
      tap({
        next: () => {
          span.setStatus({ code: SpanStatusCode.OK })

          const statusCode = res?.statusCode ?? HttpStatus.OK
          span.setAttribute('http.status_code', statusCode)

          // Saving enabled and status code not in excludeBodyCodes
          if (config.saveBodyOnSuccess && !excludeBodyCodes.includes(statusCode)) {
            span.setAttribute('http.request.body', this.getBody(req, config))
          }

          span.end()
        },
        error: (error) => {
          const statusCode = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          })
          span.setAttribute('http.status_code', statusCode)

          // Saving enabled and error code not in excludeBodyCodes
          if (config.saveBodyOnError && !excludeBodyCodes.includes(statusCode)) {
            span.setAttribute('http.request.body', this.getBody(req, config))
          }

          span.recordException(error)
          span.end()
        },
      }),
    )
  }

  private getBody(request: any, config: TelemetryConfig): string {
    try {
      const body = request.body
      if (body === undefined || body === null) return ''

      const formattedBody = this.sanitizeObject(body, config)

      if (typeof formattedBody === 'object') {
        return JSON.stringify(formattedBody)
      } else {
        return String(formattedBody)
      }
    } catch {
      return 'BODY ERROR'
    }
  }

  private extractAdditionalAttributes(request: any, config: TelemetryConfig): Attributes {
    const attributes: Attributes = {}
    for (const attribute of config.additionalAttributes ?? []) {
      const keys = attribute.path.split('.')
      const value = getNested(request, keys)

      attributes[attribute.name] = value
    }

    return attributes
  }

  private sanitizeObject(obj: any, config: TelemetryConfig): any {
    if (!obj || typeof obj !== 'object') return obj

    const patternsToExclude = config.sensitiveKeys ?? this.defaultSensitivePatterns

    const sanitized = Array.isArray(obj) ? [] : {}

    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveKey(key, patternsToExclude)) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, config)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  private isSensitiveKey(key: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(key))
  }

  private getRequest(context: ExecutionContext) {
    if (context.getType() === 'http') return context.switchToHttp().getRequest()
    return context.switchToRpc().getContext()
  }

  private getResponse(context: ExecutionContext) {
    if (context.getType() === 'http') return context.switchToHttp().getResponse()
    return undefined
  }
}
