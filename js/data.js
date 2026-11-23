/* Synthetic sample data. Fictional people, fictional startup. No real personal data. */
const GT_NUDGEPAY = {
  id: 'nudgepay', title: 'Freelance invoicing',
  startup: 'NudgePay: an app that automatically chases late invoices for freelancers',
  assumptions: [
    { id: 'A1', text: 'Freelancers are paid late regularly (at least once a month).' },
    { id: 'A2', text: 'Chasing late payments is time-consuming enough that freelancers want to automate it.' },
    { id: 'A3', text: 'Freelancers will trust software to send payment reminders automatically in their own name.' },
    { id: 'A4', text: 'Freelancers will pay at least 15 euros per month for this.' },
    { id: 'A5', text: 'Late payment is the single biggest business problem freelancers face.' },
  ],
  interviews: [
`Interviewer: Tell me about the last time a client paid you late.
Maya: Last month actually. A branding client sat on a 2,400 euro invoice for 47 days. I sent one polite email at day 30 and then a WhatsApp at day 40 and she paid the next morning.
Interviewer: How much time did that take you?
Maya: Honestly maybe ten minutes in total. The time isn't the problem. What kills me is the knot in my stomach before I hit send. I rewrote that email four times.
Interviewer: Wouldn't it be great if an app just chased clients automatically for you?
Maya: I mean, sure, in theory. But I wouldn't want a robot signing off as me. These clients found me through word of mouth, and if the message sounds cold I could lose them.
Interviewer: What do you use today to track invoices?
Maya: A Notion table. I check it on Mondays. It's free and it works fine.
Interviewer: What's the hardest part of running your business right now?
Maya: Finding the next client, honestly. Cash flow is annoying, but a quiet pipeline scares me much more.`,

`Interviewer: How often are you paid late?
Tomás: Probably two invoices out of every five. Agencies are the worst, they treat thirty days as a suggestion.
Interviewer: What do you do about it?
Tomás: I've got a recurring calendar reminder to check my bank account every Friday, and then I chase by email. I pay 12 euros a month for an invoicing tool already, Indy, and the reminders it sends are so stiff that I turn them off.
Interviewer: Would you pay for something that chased clients for you?
Tomás: If it saved me real money, maybe. Fifteen a month feels like my ceiling. I'd want to see it work first.
Interviewer: Would you let it send emails in your name?
Tomás: Only if I could see every message before it goes out. I had one automated email go wrong once and it embarrassed me in front of a client.
Interviewer: And the biggest challenge in your business?
Tomás: Chasing money is number one, no contest. Last year I had 6,000 euros stuck for three months and I almost missed rent.`,

`Interviewer: Does late payment happen to you much?
Chloé: Rarely, to be honest. Most of my clients are mid-size companies with proper accounts payable. Maybe one in twelve invoices is late.
Interviewer: So it's not a big problem for you?
Chloé: It's an annoyance but not a big one. When it happens I forward the invoice to their finance contact and it sorts itself out. Takes two minutes.
Interviewer: Imagine a tool that reminded clients for you, would you use it?
Chloé: Probably not. I'd rather pay for something that helps me find consultancy projects. That's where I'm struggling, the pipeline is lumpy.
Interviewer: Do you pay for any software at the moment?
Chloé: Just Figma and a 9 euro a month bookkeeping app. I'd resist adding another subscription.`,

`Interviewer: Tell me about late payments in your work.
Jonas: Weddings are fine because I take a deposit. But corporate shoots, constantly. Three invoices are outstanding right now, about 3,800 euros.
Interviewer: What are you doing about them?
Jonas: Nothing yet, and that's the problem. I keep putting it off because I hate the awkward conversation. I'd honestly pay someone to do the nagging for me.
Interviewer: Would you trust software to do it?
Jonas: Yes, if it kept the tone friendly, and I'd want to approve the template first. I wouldn't want it improvising.
Interviewer: How much would you pay?
Jonas: Twenty a month if it actually got me paid. I've spent more than that on worse things.
Interviewer: Is this your biggest business problem?
Jonas: Top two. Bookings in winter are the other one.`,

`Interviewer: Do clients pay you late?
Priya: All the time. I'd say a third of invoices.
Interviewer: How do you handle it?
Priya: I have a spreadsheet and I colour the overdue rows red. Then I procrastinate for a week before I write the email. I once waited 90 days to chase a 1,100 euro invoice because I was dreading it.
Interviewer: Wouldn't you love it if software handled those emails for you?
Priya: Yes, absolutely, that sounds amazing.
Interviewer: Would you be comfortable with it sending without you seeing it?
Priya: Hmm. Not really. I'd want to read it first, my voice is my brand.
Interviewer: What do you pay for tools today?
Priya: Mostly free stuff. I'd pay maybe 10 euros if it was really good.`,
  ],
};

const GT_SHIFTFILL = {
  id: 'shiftfill', title: 'Restaurant shift gaps',
  startup: 'ShiftFill: an app that fills last-minute restaurant shift gaps by offering them to staff',
  assumptions: [
    { id: 'A1', text: 'Restaurant managers have to fill a last-minute shift gap at least once a week.' },
    { id: 'A2', text: 'Managers fill gaps by messaging staff one by one, and it takes them over 30 minutes each time.' },
    { id: 'A3', text: 'Staff would pick up extra shifts through an app that shows open shifts.' },
    { id: 'A4', text: 'Owners will pay 49 euros per month per location for this.' },
  ],
  interviews: [
`Interviewer: When did someone last call in sick at short notice?
Ana: Saturday. Two baristas texted me at 6am, both sick, same flu. That happens most weeks in winter.
Interviewer: Walk me through what you did.
Ana: I opened our WhatsApp group and asked who could come in. Then I messaged three people directly because nobody answered the group. It took about forty minutes before Léa said yes.
Interviewer: Do your staff like picking up extra shifts?
Ana: The students do, they want the hours. But they hate being asked on the spot. They'd rather see the open shifts and grab them.
Interviewer: Would your owner pay for a tool like this?
Ana: He pays for nothing he can't see on the till. Our scheduling app is 30 euros a month and he still complains about it.`,

`Interviewer: How often do you have gaps to fill at the last minute?
Marcus: Maybe twice a month. We overstaff Fridays on purpose so one no-show doesn't hurt.
Interviewer: And when it does happen?
Marcus: I call my two most reliable cooks. One of them almost always says yes. Five minutes, done.
Interviewer: Wouldn't it be easier if an app did that for you?
Marcus: Sure, I guess so.
Interviewer: What would you pay for it?
Marcus: We already use 7shifts and it has a shift-swap feature nobody uses. I'm not buying a second tool for the same thing.`,

`Interviewer: How are gaps handled across your locations?
Sofia: Every location manager does it differently, and that's my headache. Last month one site ran a whole dinner service two people short because the manager gave up after a few calls.
Interviewer: What did that cost?
Sofia: We comped about 600 euros of food after complaints, plus a bad review.
Interviewer: Would staff use an app to pick up shifts?
Sofia: Our younger staff live on their phones. When we trialled a group chat for open shifts, fills went up, but managers kept bypassing it.
Interviewer: Budget?
Sofia: If it worked across all six sites I'd sign off on 300 a month without asking anyone. Per location, 49 is fine if it saves one disaster.`,

`Interviewer: Tell me about the last time you were short-staffed.
Dev: Tuesday lunch. I ended up on the grill myself, which is normal for me, I'm on the line most days anyway.
Interviewer: Did you try to find someone?
Dev: I texted maybe six people one by one. Half didn't reply until the evening. I spend more time chasing people than cooking some weeks.
Interviewer: Would you trust an app to offer the shift to the right people?
Dev: Only if I choose who gets offered what. I won't have a new kid on the grill during a rush.
Interviewer: And price?
Dev: Forty-nine a location is a lot when margins are three percent. Twenty, maybe.`,
  ],
};
window.GT_SAMPLES = [GT_NUDGEPAY, GT_SHIFTFILL];
window.GT_SAMPLE = GT_NUDGEPAY;
