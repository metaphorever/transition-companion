# Transition Companion — Product Spec

## What this is

A tool to help track the complicated and interrelated steps and processes
involved in navigating gender transition. It is a checklist, a reminder app,
a diary, a knowledge base, a tool for self-discovery, and a way to surface
good and bad news about legal changes. It has to be more than the sum of
those parts.

The whole app sits on a defining tension that has to be held in balance
everywhere it shows: "other people have done this, you can too" alongside
"what path to take is totally up to the user." **No assumptions, no wrong
way to be or want to become.**

## Who it's for

For me first. If it helps me enough to seem worth the continued effort, then
for every trans person and cis ally who finds it helpful for them. Built
with community and openness in the roots, in anticipation of that flow.

## What need it addresses

Transitioning is hard and can feel isolating. Trans people deserve all the
help they can get. I learn life-changing information about my medical care
from Tumblr posts and Wayback Machine pages of deleted blogs. I need a place
to put everything I have learned in one place, and I want everyone else with
hard-learned knowledge to be able to share theirs too. The hour I spend on
the phone confirming a policy should save the next person that hour — and
give them certainty that they are sending the right documents to the right
address.

This is not something a general-purpose tool — Finch, GTD, a notes app — can
hold. It is a tangled web of social, legal, medical, and personal decisions
and actions that has to be mapped in a way that recognizes the unique
complexities of gender transition.

It is also a never-ending process in two senses: self-discovery does not
stop, and twenty years after transition you may still get mail with an old
name and have to add a task to update or unsubscribe from something. The
tool has to accept that shape rather than try to "finish" you.

## Success and failure

**Concrete success bar.** I have legal name change work in progress. If the
tool can help me through 100% of the legal steps I am allowed to do, that is
succeeding for me.

**Beyond that.**
- If it helps others, the success becomes meaningful in a different way.
- If it takes on a life of its own, then it has really done something
  worthwhile.

**Failure modes — the two I worry about most.**

1. **Bikeshedding the app instead of using it.** Building the tool
   indefinitely is a way of avoiding the work the tool is supposed to help
   me do.

2. **The basic features getting in the way enough that bare-knuckling the
   process becomes easier than using the tool.** I already have a page of
   dogfood notes — most of them are things I could ignore, but they are
   annoying enough that I get stuck noting errors instead of using the app
   to manage actual tasks. That is the failure mode I am inside of right
   now, in miniature. Letting that pattern compound is the real risk.

Failure may be a bad direction worth correcting, or a signal that the larger
concept is wrong. Both are valid information; both require honest reading.

## Out of scope

**Explicit negatives.** Not an everything app. Not a chat app, not a t4t
dating site, not an AI chatbot front end, not a mutual aid crypto wallet.

**Adjacent tracking ideas that get asked for and are out of scope here.**

Things like transition timeline photos and health / measurement logging
(weight, hormone levels, mood) are supportable as stub task templates the
user can customize — a recurring reminder, free-text notes pointing to
wherever the user stores the underlying data. No new screens, no
specialized UI, no dedicated infrastructure inside this app.

A versatile tracking companion that can push and pull from Transition
Companion data may be worth building as a v2. It would be a separate
project, not a feature here.

**Infrastructure rule.** Any new infrastructure — a new screen, a new
specialized data model, a new dependency — has to be justified as
*required*, not "nice to have." The default is: build a simple version
using the tools that already exist (recurring tasks, notes, custom items),
or make the case that the new infra is load-bearing.

**Scope philosophy.** Map what is relevant; keep the scope focused on
knowledge, resources, and tracking information to map progress on tasks.
