export type LegalSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocumentId = 'privacy' | 'terms';

const privacySections: LegalSection[] = [
  {
    paragraphs: [
      'Effective date: 29 September 2026. Language: English.',
      'This policy explains what information Mafia Wars collects, why it is collected, and how you can access or delete it. Mafia Wars is a free multiplayer social-deduction game. The mobile app and the website are offered to players worldwide. They are not aimed at any one country, and they are not directed at children under 13.',
      'The same rights in this policy are available to every player. Extra notes for particular regions are included only where local law asks us to be more specific. Those notes do not reduce the rights offered to everyone else.',
    ],
  },
  {
    heading: 'Who we are',
    paragraphs: [
      'Mafia Wars is published by Sayyed Muhammad Arif Hussain, an individual developer. For privacy requests, email sayed.arif2001@gmail.com. The developer lives in Pakistan. That is the place from which the game is operated. It is not a limit on who may play.',
    ],
  },
  {
    heading: 'Information we collect',
    paragraphs: [
      'We collect only what the game needs to create an account, confirm that you are old enough to play, and run a match.',
    ],
    bullets: [
      'Account details. Email address, display name, and a password. Passwords are stored only as a hash, or are handled by the sign-in provider. We do not keep a readable copy of your password.',
      'Date of birth. We ask for this to confirm that you meet the age rule. On the mobile app, that check happens on your device and the date of birth is not uploaded. On the website, the date of birth is stored with your account so the age check can be kept.',
      'Game and lobby activity. Room codes, the display names of people in a room, roles, votes, and whether a player is connected. This is used to run the match. Other people in the same room can see your display name, and can see your role when the rules reveal it.',
      'Session data. A login token so you can stay signed in.',
      'Technical data. The host that serves the app or website may log an IP address, device or browser type, and basic request or error data so the service can run and so we can investigate abuse or outages.',
    ],
  },
  {
    paragraphs: [
      'We do not ask for your phone contacts, photos, precise location, or payment card details. The current game has no advertising and no in-app purchases. We do not sell personal information, and we do not share it with advertisers or data brokers.',
    ],
  },
  {
    heading: 'How we use it',
    bullets: [
      'Create and sign you into your account, and provide the game you asked for.',
      'Apply the age rule.',
      'Place you in a room and run the match.',
      'Answer support, access, correction, and deletion requests.',
      'Protect the service against abuse, such as repeated failed sign-ins or attempts to disrupt a room.',
    ],
  },
  {
    heading: 'Who else processes it',
    paragraphs: [
      'When the mobile app is connected to cloud sign-in and cloud lobbies, Google Firebase (Authentication and Cloud Firestore) processes your email, password credential, and lobby records for us. Google may process that data in the United States and other countries where Google operates.',
      'The website game server is operated by us. Active matches are kept in memory so the round can finish. They are not stored as a permanent match history, and they are lost if the server restarts.',
      'We do not use a separate advertising or analytics product. Firebase may still process the operational data required to provide Authentication and Firestore. We have not put in place separate Standard Contractual Clauses of our own with players. Where a provider such as Google offers its own international-transfer terms, those terms apply to that provider’s processing.',
    ],
  },
  {
    heading: 'Where it is processed',
    paragraphs: [
      'Account and game data may be processed in Pakistan, because that is where the developer operates the service. If you use cloud sign-in or cloud lobbies, Google may also process that data in the United States and other countries. Those countries may not provide the same level of legal protection as the country where you live.',
      'If you are in the European Economic Area, the United Kingdom, or Switzerland, Pakistan does not have an adequacy decision from the European Commission. By creating an account, you consent to this transfer and storage so that we can provide the game. You may withdraw that consent by asking us to delete your account. Withdrawal does not affect processing that happened before the withdrawal, and we may not be able to keep providing the game without the account data.',
    ],
  },
  {
    heading: 'How long we keep it',
    bullets: [
      'Account data (email, display name, password hash, and, on the website, date of birth) is kept until you delete the account or we close it.',
      'Lobby and match data is kept only while that room or match exists.',
      'Login tokens are kept until you log out, the token is replaced, or the account is deleted.',
      'Security and error logs that contain an IP address are kept only as long as needed to operate and protect the service, and not longer than 90 days, unless a longer period is required to investigate abuse or to comply with law.',
    ],
  },
  {
    heading: 'Your rights',
    paragraphs: [
      'Wherever you live, you may email sayed.arif2001@gmail.com from the address on the account to:',
    ],
    bullets: [
      'Ask for a copy of the account data we hold.',
      'Correct your display name or email.',
      'Delete your account and the personal information tied to it.',
      'Withdraw consent to processing that is based on consent, including the international transfer described above.',
      'Object to processing that is based on our legitimate interests. We will stop unless we have a compelling reason to continue, such as investigating abuse.',
    ],
  },
  {
    paragraphs: [
      'For deletion, use the subject “Mafia Wars account deletion” and say whether you use the mobile app, the website, or both. We will delete the account data we hold within 30 days. That includes your email, display name, date of birth if we stored it, password hash, and login tokens. We may keep a minimal record if we must do so to comply with law, resolve a security incident, or prevent abuse of the same account. Uninstalling the app does not delete a cloud or website account.',
      'We will not charge you for a reasonable request, and we will not treat you differently because you made one.',
    ],
  },
  {
    heading: 'Players in the EEA, the United Kingdom, and Switzerland',
    paragraphs: [
      'If the data-protection law of your country applies, the developer named above is the controller of the account and game data we hold. We use that data on these bases:',
    ],
    bullets: [
      'Contract. To create your account and run the game you asked to play.',
      'Legitimate interests. To keep the service secure, prevent abuse, and understand outages. Those interests are limited to operating a small multiplayer game, and they do not override your rights.',
      'Consent. For the age check you choose to complete, and for transferring account data to Pakistan and, when cloud features are on, to Google, as described above.',
      'Legal obligation. Where we must keep or disclose information to comply with law.',
    ],
  },
  {
    paragraphs: [
      'You may lodge a complaint with the data-protection authority in your country. That right is in addition to emailing us. A list of European authorities is published by the European Data Protection Board. In the United Kingdom, the authority is the Information Commissioner’s Office. In Switzerland, it is the Federal Data Protection and Information Commissioner.',
    ],
  },
  {
    heading: 'Players in the United States',
    paragraphs: [
      'We do not sell personal information, and we do not share it for cross-context behavioral advertising. We do not respond to browser “Do Not Track” signals because the game does not track you across other companies’ apps or websites for advertising.',
      'The access, correction, and deletion rights above are offered to every player, including players in California and other US states. This policy does not claim that Mafia Wars is a business covered by the California Consumer Privacy Act. A new free game operated by one developer does not meet that law’s size thresholds. Offering these rights is a choice, not a statement that those statutes apply.',
    ],
  },
  {
    heading: 'Age',
    paragraphs: [
      'You must be at least 13 years old to create an account. If the law where you live sets a higher age for consenting to this kind of service, you must meet that higher age. The game is not directed to children under 13, and it is not part of a program for children. We do not knowingly collect personal information from a child under 13. If you believe we have, email sayed.arif2001@gmail.com and we will delete it.',
    ],
  },
  {
    heading: 'Security',
    paragraphs: [
      'We limit access to account data and store passwords in a form that is not readable. Production traffic is intended to use HTTPS. No method of storage or transmission is completely secure.',
    ],
  },
  {
    heading: 'Changes',
    paragraphs: [
      'If we change this policy, we will update this page and the effective date. The English text is the version that controls. If a change materially expands what we collect or who we share it with, we will ask you to accept the update in the app or on the website before it applies to you.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: ['Sayyed Muhammad Arif Hussain, Pakistan. sayed.arif2001@gmail.com'],
  },
];

const termsSections: LegalSection[] = [
  {
    paragraphs: [
      'Effective date: 29 September 2026. Language: English.',
      'These terms are an agreement between you and Sayyed Muhammad Arif Hussain (“we”, “us”) for the Mafia Wars mobile app and website. The game is offered worldwide. By creating an account, or by accepting these terms, you agree to them and to the Privacy Policy. If a translation of these terms is ever published, the English text controls.',
    ],
  },
  {
    heading: 'The service',
    paragraphs: [
      'Mafia Wars is a free multiplayer game for personal entertainment. Players are assigned fictional roles and try to win a round by voting and using those roles. Nothing in the game is an invitation to harm a real person. There is no price, no virtual currency, and no paid items. The service is operated by one developer and may change, pause, or stop.',
    ],
  },
  {
    heading: 'Who may play',
    paragraphs: [
      'You must be at least 13 years old. If the law of the country where you live requires a higher age before you can agree to a service like this, you must meet that higher age. You must give a true date of birth for the age check. If you are under 18, you confirm that a parent or guardian agrees to these terms. You are responsible for activity under your password. One person should keep one account.',
    ],
  },
  {
    heading: 'Your account',
    paragraphs: [
      'Keep your password private. Tell us at sayed.arif2001@gmail.com if you believe someone else is using your account. We may refuse a display name, reset a room, or close an account that breaks these terms.',
      'To delete an account, email sayed.arif2001@gmail.com from the address on the account with the subject “Mafia Wars account deletion”. We will delete the personal information described in the Privacy Policy within 30 days. Removing the app from your device does not delete the account.',
    ],
  },
  {
    heading: 'Acceptable use',
    paragraphs: ['You may play the game for personal, non-commercial entertainment. You agree not to:'],
    bullets: [
      'Use a display name that is illegal, hateful, sexually exploitative, threatening, or that impersonates another person.',
      'Harass other players, including through a display name or by disrupting a room.',
      'Attempt to access another player’s account, role, or votes, or to interfere with the server.',
      'Use cheats, bots, or automated clients, except a normal browser or the official app.',
      'Reverse engineer the service in order to cheat or to attack it.',
      'Use the game for anything unlawful where you live or where the service is operated.',
    ],
  },
  {
    paragraphs: ['There is no player chat inside the current game. If you talk to other players outside the app, you do that on your own.'],
  },
  {
    heading: 'Other players',
    paragraphs: [
      'People in your room can see your display name and the information the rules reveal, such as votes and the final roles. Do not put your phone number, address, or other private details in your display name.',
    ],
  },
  {
    heading: 'Availability',
    paragraphs: [
      'Matches can end early if the server restarts, if a player disconnects, or if there are not enough players. We do not promise that a room, a round, or a saved login will always be available. Features may differ for a short time between the app and the website while the game is still in early release.',
    ],
  },
  {
    heading: 'Our content',
    paragraphs: [
      'The game, its name, artwork, text, and code are owned by us or used with permission. These terms do not give you ownership of them. You may not copy the game and publish it as your own.',
    ],
  },
  {
    heading: 'Disclaimers',
    paragraphs: [
      'The game is provided “as is” and “as available”. To the extent the law allows, we disclaim warranties of merchantability, fitness for a particular purpose, and uninterrupted or error-free operation. Some places do not allow those disclaimers. Where that is the case, they apply only as far as the law allows, and they do not affect rights that cannot legally be limited.',
    ],
  },
  {
    heading: 'Liability',
    paragraphs: [
      'To the extent the law allows, we are not liable for indirect, incidental, or consequential loss, or for lost data, lost matches, or lost profits, arising from your use of the game. If we are liable for a claim relating to the game, that liability is limited to the amount you paid us for it in the three months before the claim. If you paid nothing, that limit is zero.',
      'Nothing in these terms limits liability that the law where you live does not allow us to limit. That includes liability for fraud, and for death or personal injury caused by negligence, where such a limit is forbidden. It also includes any non-waivable consumer remedy.',
    ],
  },
  {
    heading: 'Disputes',
    paragraphs: [
      'If you have a problem with the game, email sayed.arif2001@gmail.com first and give us a reasonable chance to resolve it. These terms do not require arbitration, and they do not waive any right to bring a claim with other people where the law gives you that right.',
      'The contract law of Pakistan governs these terms, because that is where the developer lives and operates the service. This choice does not override a mandatory consumer-protection right in the country where you live. If such a right conflicts with these terms, that right controls. You may also use any court or procedure that the law of your country says we cannot take away from you.',
    ],
  },
  {
    heading: 'Ending these terms',
    paragraphs: [
      'You may stop using the game and request deletion at any time. We may suspend or close access if you break these terms, if we must do so for legal or safety reasons, or if we discontinue the game. Sections that should survive, including acceptable use, disclaimers, liability, and the dispute terms, still apply.',
    ],
  },
  {
    heading: 'Changes',
    paragraphs: [
      'We may update these terms by posting a new version and changing the effective date. If a change is material, we will ask you to accept it in the app or on the website before you keep playing. If you do not agree, stop using the game and request deletion.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: ['Sayyed Muhammad Arif Hussain, Pakistan. sayed.arif2001@gmail.com'],
  },
];

export const legalDocuments: Record<LegalDocumentId, { title: string; sections: LegalSection[] }> = {
  privacy: { title: 'Privacy Policy', sections: privacySections },
  terms: { title: 'Terms of Service', sections: termsSections },
};
