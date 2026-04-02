import { redirect } from 'next/navigation';

export default function ColorsPage() {
  redirect('/portfolio?view=colors');
}
