// Team V3S: edit this list to change the Meet the Team page (/team).
//
// photo:    a file name inside /public/team/ (for example 'shivansh.jpg'). Leave '' to show the placeholder avatar.
// role:     'TODO' shows "Role to be added" on the card.
// email, github, linkedin: leave '' until you have the real value. Nothing is shown as a link while empty.
//   github:   full URL, e.g. 'https://github.com/username'
//   linkedin: full URL, e.g. 'https://www.linkedin.com/in/username'

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  photo: string;
  email: string;
  github: string;
  linkedin: string;
}

export const TEAM_NAME = 'Team V3S';

export const TEAM: TeamMember[] = [
  {
    id: 'shivansh',
    name: 'Shivansh',
    role: 'Team Leader & Lead Developer',
    photo: '',
    email: '',
    github: 'https://github.com/ShivanshS35',
    linkedin: '',
  },
  {
    id: 'vivek-rajput',
    name: 'Vivek Rajput',
    role: 'TODO',
    photo: '',
    email: '',
    github: '',
    linkedin: '',
  },
  {
    id: 'shubh-agrawal',
    name: 'Shubh Agrawal',
    role: 'TODO',
    photo: '',
    email: '',
    github: '',
    linkedin: '',
  },
  {
    id: 'shreyansh-saxena',
    name: 'Shreyansh Saxena',
    role: 'TODO',
    photo: '',
    email: '',
    github: '',
    linkedin: '',
  },
];
