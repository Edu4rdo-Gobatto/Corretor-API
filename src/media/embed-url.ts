const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;
const vimeoIdPattern = /^\d+$/;

export function canonicalEmbedUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (hostname === 'youtu.be' && segments.length === 1 && youtubeIdPattern.test(segments[0])) {
    return `https://www.youtube-nocookie.com/embed/${segments[0]}`;
  }

  if (hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') {
    const id = parsed.pathname === '/watch' && parsed.searchParams.getAll('v').length === 1
      ? parsed.searchParams.get('v')
      : (segments.length === 2 && ['embed', 'shorts'].includes(segments[0]) ? segments[1] : null);
    return id && youtubeIdPattern.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  if (hostname === 'vimeo.com' && segments.length === 1 && vimeoIdPattern.test(segments[0])) {
    return `https://player.vimeo.com/video/${segments[0]}`;
  }

  if (hostname === 'player.vimeo.com' && segments.length === 2 && segments[0] === 'video' && vimeoIdPattern.test(segments[1])) {
    return `https://player.vimeo.com/video/${segments[1]}`;
  }

  return null;
}

