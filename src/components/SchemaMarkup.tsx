'use client';

interface SchemaMarkupProps {
  type: 'Organization' | 'WebSite' | 'Collection' | 'FAQPage';
  data?: any;
}

export default function SchemaMarkup({ type, data }: SchemaMarkupProps) {
  let schema: any;

  if (type === 'Organization') {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'MyGurukul',
      description: 'AI-powered platform for exploring ancient Sanskrit wisdom',
      url: 'https://www.mygurukul.org',
      logo: 'https://www.mygurukul.org/logo.png',
      sameAs: [],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Support',
      },
    };
  } else if (type === 'WebSite') {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'MyGurukul',
      url: 'https://www.mygurukul.org',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://www.mygurukul.org/library?q={search_term_string}',
        },
        query_input: 'required name=search_term_string',
      },
    };
  } else if (type === 'Collection') {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'Collection',
      name: 'Sacred Library - Ancient Sanskrit Texts',
      description:
        '79+ authentic Sanskrit texts across 10 categories including Vedas, Upanishads, Puranas, and Ayurveda',
      url: 'https://www.mygurukul.org/library',
      itemCount: 79,
      numberOfItems: 10,
      category: data?.categories || [
        'Vedas',
        'Upanishads',
        'Puranas',
        'Ayurveda',
        'Darshanas',
        'Epics',
        'Poetry',
        'Sastras',
      ],
    };
  } else if (type === 'FAQPage') {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (data?.faqs || []).map((faq: any) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
