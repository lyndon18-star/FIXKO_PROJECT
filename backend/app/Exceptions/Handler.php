<?php
namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class Handler extends ExceptionHandler
{
    public function render($request, Throwable $exception)
    {
        if ($this->isApiRequest($request)) {
            return $this->renderApiException($request, $exception);
        }

        return parent::render($request, $exception);
    }

    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($this->isApiRequest($request)) {
            return $this->apiError($request, 'Unauthenticated.', 401, 'UNAUTHENTICATED');
        }

        return redirect()->guest($exception->redirectTo($request) ?? route('login'));
    }

    private function renderApiException(Request $request, Throwable $exception): JsonResponse
    {
        if ($exception instanceof ValidationException) {
            return $this->apiError(
                $request,
                'Please check the submitted information.',
                422,
                'VALIDATION_ERROR',
                $exception->errors()
            );
        }

        if ($exception instanceof AuthenticationException) {
            return $this->apiError($request, 'Unauthenticated.', 401, 'UNAUTHENTICATED');
        }

        if ($exception instanceof AuthorizationException) {
            return $this->apiError($request, 'You do not have permission to perform this action.', 403, 'FORBIDDEN');
        }

        if ($exception instanceof ModelNotFoundException) {
            return $this->apiError($request, 'The requested item could not be found.', 404, 'NOT_FOUND');
        }

        if ($exception instanceof HttpExceptionInterface) {
            return $this->apiError(
                $request,
                $exception->getMessage() ?: 'The request could not be completed.',
                $exception->getStatusCode(),
                $this->httpErrorCode($exception->getStatusCode())
            );
        }

        if ($exception instanceof QueryException) {
            Log::error('Database exception while handling API request.', [
                'request_id' => $this->requestId($request),
                'method' => $request->method(),
                'path' => $request->path(),
                'exception' => $exception,
            ]);
        } else {
            Log::error('Unhandled API exception.', [
                'request_id' => $this->requestId($request),
                'method' => $request->method(),
                'path' => $request->path(),
                'exception' => $exception,
            ]);
        }

        return $this->apiError(
            $request,
            'An unexpected server error occurred.',
            500,
            'SERVER_ERROR'
        );
    }

    private function apiError(
        Request $request,
        string $message,
        int $status,
        string $code,
        array $errors = []
    ): JsonResponse {
        $payload = [
            'message' => $message,
            'code' => $code,
            'request_id' => $this->requestId($request),
        ];

        if ($errors !== []) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status)->header('X-Request-ID', $payload['request_id']);
    }

    private function isApiRequest($request): bool
    {
        return $request instanceof Request
            && ($request->is('api/*') || $request->expectsJson());
    }

    private function requestId(Request $request): string
    {
        $existingRequestId = $request->attributes->get('request_id');
        if (is_string($existingRequestId)) {
            return $existingRequestId;
        }

        $requestId = $request->header('X-Request-ID');
        $requestId = is_string($requestId) && preg_match('/^[A-Za-z0-9._-]{1,100}$/', $requestId)
            ? $requestId
            : (string) Str::uuid();

        $request->attributes->set('request_id', $requestId);

        return $requestId;
    }

    private function httpErrorCode(int $status): string
    {
        return match ($status) {
            400 => 'BAD_REQUEST',
            401 => 'UNAUTHENTICATED',
            403 => 'FORBIDDEN',
            404 => 'NOT_FOUND',
            405 => 'METHOD_NOT_ALLOWED',
            409 => 'CONFLICT',
            422 => 'UNPROCESSABLE_ENTITY',
            429 => 'TOO_MANY_REQUESTS',
            default => 'HTTP_ERROR',
        };
    }
}
