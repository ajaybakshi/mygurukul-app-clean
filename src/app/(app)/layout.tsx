import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MyGurukul - Ancient Indian Wisdom & Sacred Scriptures',
  description: 'Explore authentic Sanskrit scriptures, Vedic wisdom, Upanishads, Bhagavad Gita, Ayurveda, Yoga texts, and ancient Indian spiritual literature. AI-powered spiritual guidance from original Sanskrit sources.',
  keywords: [
    'Sanskrit scriptures',
    'ancient Indian texts',
    'Vedic wisdom',
    'Upanishads',
    'Bhagavad Gita',
    'Bhagvad Gita',
    'Ayurveda',
    'Yoga texts',
    'Yoga Sutras',
    'Patanjali',
    'Ramayana',
    'Mahabharata',
    'Puranas',
    'Vedas',
    'Rig Veda',
    'Yajur Veda',
    'Sama Veda',
    'Atharva Veda',
    'Caraka Samhita',
    'Charaka Samhita',
    'Sushruta Samhita',
    'Manu Smriti',
    'Arthashastra',
    'Kama Sutra',
    'Natya Shastra',
    'spiritual wisdom',
    'dharma',
    'karma',
    'moksha',
    'ancient wisdom',
    'sacred texts',
    'Hindu scriptures',
    'Indian philosophy',
    'Vedanta',
    'Advaita',
    'spiritual guidance',
    'AI spiritual advisor',
  ],
  openGraph: {
    title: 'MyGurukul - Ancient Indian Wisdom & Sacred Scriptures',
    description: 'Explore authentic Sanskrit scriptures, Vedic wisdom, Upanishads, Bhagavad Gita, Ayurveda, Yoga texts, and ancient Indian spiritual literature.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyGurukul - Ancient Indian Wisdom & Sacred Scriptures',
    description: 'Explore authentic Sanskrit scriptures, Vedic wisdom, Upanishads, Bhagavad Gita, Ayurveda, Yoga texts, and ancient Indian spiritual literature.',
  },
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

