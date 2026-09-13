import { canonicalEmbedUrl } from './embed-url';

describe('canonical embed URL policy', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://vimeo.com/123456789', 'https://player.vimeo.com/video/123456789'],
    ['https://player.vimeo.com/video/123456789?autoplay=1', 'https://player.vimeo.com/video/123456789'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
  ])('canonicalizes %s', (input, expected) => {
    expect(canonicalEmbedUrl(input)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?x=dQw4w9WgXcQ',
    'https://vimeo.com/not-a-number',
    'https://evil.example/video/123456789',
  ])('rejects unsafe or malformed URL %s', (input) => {
    expect(canonicalEmbedUrl(input)).toBeNull();
  });
});

