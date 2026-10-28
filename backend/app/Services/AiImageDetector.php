<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;

/**
 * Detects AI-generated images uploaded to reports.
 *
 * Runs fully offline using heuristics:
 *  1. Embedded generator metadata — most AI tools stamp their output
 *     (C2PA / JUMBF content credentials, EXIF "Software", PNG tEXt chunks).
 *  2. Raw byte scan for known generator signatures inside the file.
 *
 * This is a pragmatic on-premise check: it reliably catches images saved
 * straight from Midjourney / DALL·E / Stable Diffusion / Firefly / Bing /
 * Gemini etc., plus C2PA-signed content. Re-encoded or stripped images
 * may pass, and admins can still flag suspicious reports manually.
 */
class AiImageDetector
{
    /** Lowercase fragments that mark AI-generated content in metadata. */
    private const SIGNATURES = [
        'c2pa', 'jumbf', 'contentcredentials', 'content credentials',
        'midjourney', 'stable diffusion', 'stablediffusion', 'stable-diffusion',
        'dall-e', 'dallـe', 'dall·e', 'openai', 'comfyui', 'automatic1111',
        'adobe firefly', 'firefly generative', 'generative fill',
        'bing image creator', 'image creator from', 'gemini', 'imagen',
        'novelai', 'novel ai', 'nmkd', 'tensor.art', 'civitai',
        'trainedAlgorithmicNet', 'photoshop', // only flagged with generative context below
    ];

    public function detect(UploadedFile $file): bool
    {
        $contents = @file_get_contents($file->getRealPath());
        if ($contents === false || $contents === '') {
            return false;
        }

        $haystack = strtolower($contents);

        // 1. C2PA / JUMBF content credentials (the strongest signal).
        if (str_contains($haystack, 'c2pa') || str_contains($haystack, 'jumbf')) {
            return true;
        }

        // 2. Known AI generator strings.
        foreach (['midjourney', 'stable diffusion', 'stablediffusion', 'stable-diffusion',
                  'dall-e', 'openai', 'comfyui', 'automatic1111', 'adobe firefly',
                  'firefly generative', 'generative fill', 'bing image creator',
                  'novelai', 'civitai', 'tensor.art'] as $signature) {
            if (str_contains($haystack, $signature)) {
                return true;
            }
        }

        // 3. PNG tEXt chunks produced by AI tools (parameters / prompt chunks).
        if (str_contains($haystack, 'parameters:') && str_contains($haystack, 'sampler')) {
            return true;
        }
        if (str_contains($haystack, 'negative_prompt') || str_contains($haystack, 'negative prompt')) {
            return true;
        }

        // 4. EXIF Software / ImageDescription fields (JPEG).
        $software = $this->exifValue($file, 'Software').' '.$this->exifValue($file, 'ImageDescription');
        $software = strtolower($software);
        if ($software !== ' ') {
            foreach (['midjourney', 'dall-e', 'openai', 'stable diffusion', 'firefly',
                      'gemini', 'imagen', 'novelai', 'bing image creator'] as $signature) {
                if (str_contains($software, $signature)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function exifValue(UploadedFile $file, string $key): string
    {
        try {
            if (! function_exists('exif_read_data')) {
                return '';
            }
            $exif = @exif_read_data($file->getRealPath());
            return is_array($exif) ? (string) ($exif[$key] ?? '') : '';
        } catch (\Throwable) {
            return '';
        }
    }
}
