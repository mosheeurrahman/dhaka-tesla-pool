import {
  GitHubIcon,
  LinkedInIcon,
  CodeforcesIcon,
  YouTubeIcon,
  FacebookIcon,
  EmailIcon,
} from "../icons/SocialIcons";

const LINKS = [
  {
    Icon: GitHubIcon,
    href: "https://github.com/mosheeurrahman",
    label: "GitHub",
    hoverClass: "hover:text-[#181717]",
  },
  {
    Icon: LinkedInIcon,
    href: "https://www.linkedin.com/in/mosheeurrahman",
    label: "LinkedIn",
    hoverClass: "hover:text-[#0A66C2]",
  },
  {
    Icon: CodeforcesIcon,
    href: "https://codeforces.com/profile/moshee_moshee",
    label: "Codeforces",
    hoverClass: "hover:text-[#1F8ACB]",
  },
  {
    Icon: YouTubeIcon,
    href: "https://www.youtube.com/@MosheeUrRahman",
    label: "YouTube",
    hoverClass: "hover:text-[#FF0000]",
  },
  {
    Icon: FacebookIcon,
    href: "https://www.facebook.com/mosheeur",
    label: "Facebook",
    hoverClass: "hover:text-[#1877F2]",
  },
  {
    Icon: EmailIcon,
    href: "mailto:mosheeurrahman76@gmail.com",
    label: "Email",
    hoverClass: "hover:text-rickshaw-red",
  },
];

export default function Footer() {
  return (
    <footer className="border-t-2 border-rickshaw-green/10 mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-5">
          {LINKS.map(({ Icon, href, label, hoverClass }) => (
              <a  
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className={`text-ink/35 transition-all duration-200 hover:-translate-y-0.5 ${hoverClass}`}
            >
              <Icon className="w-5 h-5" />
            </a>
          ))}
        </div>

        <div className="text-center text-sm text-ink/50 font-body">
          <p>© 2026 Made by Moshee-Ur Rahman</p>
          <p>All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}