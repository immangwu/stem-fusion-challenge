import VolunteerShow, { type Vol } from '@/components/VolunteerShow';

export const metadata = { title: 'Student Volunteers | STEM Fusion Challenge' };

const PEOPLE: Vol[] = [
  ['Prathiash S', 'ECE-B', 'prathiash'], ['B.A. Varun', 'EEE', 'varun'], ['Hashni P', 'ECE-A', 'sanjana'], ['Vighnesh M.P', 'ECE-B', 'vighnesh'],
  ['Harish Krishnan K', 'CSE-A', 'harish'], ['Ragul N', 'CSE-B', 'ragul'], ['Madhav S', 'Mech', 'madhav'], ['Kavideva R', 'IT', 'kavideva'],
  ['Nishanthini R', 'CSE-B', 'nishanthini'], ['Amirta', 'CSE-A', 'amirta'], ['Sanjana A', 'CSE-C', 'hasini'], ['Hima S', 'AI & DS', 'hima'],
  ['Dishanth D', 'EEE', 'dishanth'], ['Lokesh Anand', 'IT', 'lokesh'], ['Lakshan', 'AI & DS', 'lakshan'], ['Sakthisivaram S', 'CSE-C', 'sakthisivaram'],
  ['Thirugugan C K', 'Mech', 'thirugugan'], ['Chezhiyan', 'ECE-A', 'chezhiyan'],
].map(([name, dept, f]) => ({ name, dept, img: `/volunteers/${f}.png` }));

export default function Volunteers() {
  return <VolunteerShow people={PEOPLE} />;
}
