import { redirect } from 'next/navigation';

export default function YearsPage() {
  redirect('/portfolio?view=years');
}
