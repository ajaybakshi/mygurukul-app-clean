import Head from 'next/head';

interface SEOHeadProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  keywords?: string[];
  type?: string;
  twitterHandle?: string;
}

export default function SEOHead({
  title,
  description,
  url,
  image = '/logo.png',
  keywords = [],
  type = 'website',
  twitterHandle = '@MyGurukul', // Update if you have Twitter
}: SEOHeadProps) {
  return (
    <Head>
      {/* Primary Meta Tags */}
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <meta name="author" content="MyGurukul" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="utf-8" />

      {/* Canonical URL */}
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:creator" content={twitterHandle} />

      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#F6D55C" />
      <meta name="language" content="English" />
      <meta property="og:locale" content="en_US" />
    </Head>
  );
}
