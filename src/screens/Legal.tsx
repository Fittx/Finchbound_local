import { TopBar, Container } from "../shell";
import { SiteFooter } from "../components/SiteFooter";
import { useApp } from "../store";
const TERMS = [
  [
    "Your account",
    "Keep your sign-in details secure and provide an email address you can access. You control the books you create and the people you invite.",
  ],
  [
    "Your stories",
    "You keep ownership of the photos and messages you share. Only upload content you have permission to share. Give Finchbound permission to store and display it to the audience you choose.",
  ],
  [
    "A considerate flock",
    "Respect other people's privacy. Do not post harassment, spam or harmful content. Hosts can approve, reject, remove and report guest entries.",
  ],
  [
    "Book access",
    "A published book can be read by anyone with its link when link access is enabled. Keep a book private when it is only for you. Links can be forwarded by recipients.",
  ],
  [
    "Leaving Finchbound",
    "You can change your details or delete your account from Account. Deletion removes your account, books and guest entries permanently.",
  ],
];
const PRIVACY = [
  [
    "What you share",
    "Account details include your name and email address. Books contain the photos, titles and messages that you and your guests choose to add.",
  ],
  [
    "How it is used",
    "Your details help you sign in, recover access and manage your books. Guest details support entry verification and moderation. Book content is shown according to the host's access settings.",
  ],
  [
    "Who can see it",
    "Hosts can review guest submissions and contact details. Public readers see published book pages. Pending and rejected entries stay out of the reader.",
  ],
  [
    "Your choices",
    "Change your profile in Account, remove pages from the editor, and choose private or link access in book settings. Ask a book's host to remove a guest entry you contributed.",
  ],
  [
    "Storage and deletion",
    "This prototype uses mock services and temporary browser state. Do not use it to store sensitive information. Account deletion is a demonstration of the intended permanent deletion flow.",
  ],
];
export function Legal() {
  const { route } = useApp();
  const terms = route.path[0] === "terms";
  const back = route.query.get("from") === "signup" ? "#/signup?return=terms" : "#/";
  return (
    <div className="min-h-dvh bg-nest">
      <TopBar home="#/" />
      <Container className="py-8 md:py-12">
        <main className="mx-auto flex max-w-2xl flex-col gap-8">
          <a
            className="flex min-h-11 items-center self-start rounded-sm underline underline-offset-4"
            href={back}
          >
            {back.includes("signup") ? "Back to sign up" : "Back to Finchbound"}
          </a>
          <div className="flex flex-col gap-3">
            <h1 className="t-h1">{terms ? "Terms of service" : "Privacy policy"}</h1>
            <p className="t-caption text-muted">Prototype draft · November 17, 2026</p>
            <p className="t-body">
              These pages describe the prototype experience. Final service policies will be provided
              before launch.
            </p>
          </div>
          {(terms ? TERMS : PRIVACY).map(([title, body]) => (
            <section key={title} className="flex flex-col gap-2">
              <h2 className="t-h2">{title}</h2>
              <p className="t-body">{body}</p>
            </section>
          ))}
          <a
            className="flex min-h-11 items-center self-start rounded-sm underline underline-offset-4"
            href={back}
          >
            {back.includes("signup") ? "Back to sign up" : "Back to Finchbound"}
          </a>
        </main>
      </Container>
      <SiteFooter />
    </div>
  );
}
