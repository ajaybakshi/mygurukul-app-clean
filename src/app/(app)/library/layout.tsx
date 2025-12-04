import type { Metadata } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mygurukul.org'

export const metadata: Metadata = {
  title: 'Sacred Library - 79+ Ancient Sanskrit Texts | MyGurukul',
  description: 'Browse 79+ authentic Sanskrit scriptures including Vedas, Upanishads, Bhagavad Gita, Ramayana, Mahabharata, Puranas, Yoga Sutras, Ayurveda texts (Caraka Samhita, Sushruta Samhita), Dharma Shastras (Manu Smriti), Arthashastra, Kama Sutra, Natya Shastra, and more. Original Sanskrit with English translations.',
  keywords: [
    'Sanskrit library',
    'Vedas online',
    'Upanishads',
    'Bhagavad Gita',
    'Bhagvad Gita',
    'Ramayana',
    'Mahabharata',
    'Puranas',
    'Yoga Sutras',
    'Patanjali Yoga Sutras',
    'Ayurveda texts',
    'Caraka Samhita',
    'Charaka Samhita',
    'Sushruta Samhita',
    'Manu Smriti',
    'Arthashastra',
    'Kama Sutra',
    'Natya Shastra',
    'Vedanga Jyotisa',
    'Aryabhatia',
    'Yoga texts',
    'Hatha Yoga Pradipika',
    'Gheranda Samhita',
    'Yoga Yajnavalkya',
    'Brahma Sutras',
    'Vedanta Sutras',
    'Nyaya Sutras',
    'Vaisheshika Sutras',
    'Samkhya Karika',
    'Mimamsa Sutras',
    'Bhagavata Purana',
    'Markandeya Purana',
    'Linga Purana',
    'Vishnu Purana',
    'Shiva Purana',
    'Skanda Purana',
    'Padma Purana',
    'Garuda Purana',
    'Narada Purana',
    'Kurma Purana',
    'Matsya Purana',
    'Vayu Purana',
    'Brahma Purana',
    'Agni Purana',
    'Varaha Purana',
    'Brahmanda Purana',
    'ancient Indian texts',
    'sacred scriptures',
    'Hindu texts',
    'Sanskrit literature',
    'Vedic literature',
    'spiritual texts',
    'dharma shastras',
    'artha shastra',
    'kama shastra',
    'moksha shastra',
  ],
  openGraph: {
    title: 'Sacred Library - 79+ Ancient Sanskrit Texts | MyGurukul',
    description: 'Browse 79+ authentic Sanskrit scriptures including Vedas, Upanishads, Bhagavad Gita, Ramayana, Mahabharata, Puranas, Yoga Sutras, Ayurveda texts, and more.',
    type: 'website',
    url: `${baseUrl}/library`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sacred Library - 79+ Ancient Sanskrit Texts | MyGurukul',
    description: 'Browse 79+ authentic Sanskrit scriptures including Vedas, Upanishads, Bhagavad Gita, Ramayana, Mahabharata, Puranas, Yoga Sutras, Ayurveda texts, and more.',
  },
  alternates: {
    canonical: `${baseUrl}/library`,
  },
}

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

