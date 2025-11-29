import { redirect } from 'next/navigation';

export default function SubmitPage() {
  redirect('/');
  return null; // A component must return something
}
