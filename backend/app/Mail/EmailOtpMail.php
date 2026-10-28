<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EmailOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly string $code, public readonly int $expiresInMinutes = 10)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Fixko verification code',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.email-otp',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
