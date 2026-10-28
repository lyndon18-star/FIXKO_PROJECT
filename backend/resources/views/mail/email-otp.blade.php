<x-mail::message>
# Fixko verification code

Hello! Someone is creating a Fixko account with this school email.

Use the code below to verify your email address:

<div style="margin: 20px 0; text-align: center;">
    <span style="display: inline-block; padding: 12px 26px; font-size: 30px; font-weight: 800; letter-spacing: 10px; color: #4f46e5; background: #eef2ff; border-radius: 12px; border: 1px solid #c7d2fe;">{{ $code }}</span>
</div>

This code expires in **{{ $expiresInMinutes }} minutes** and can only be used once.

If you did not request this, you can safely ignore this email.

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
