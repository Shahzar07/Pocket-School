import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Poket School',
    short_name: 'Poket',
    description: 'Courses and Poket Reads in one shelf.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F6F6',
    theme_color: '#203337',
  };
}
