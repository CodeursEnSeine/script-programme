import z from "zod";
import slugify from "slugify";

const zTalk = () =>
  z.object({
    id: z.string(),
    title: z.string(),
    state: z.union([
      z.literal("rejected"),
      z.literal("accepted"),
      z.literal("confirmed"),
      z.literal("declined"),
    ]),
    abstract: z.string(),
    speakers: z.array(z.string()),
    createTimestamp: z.object({
      _seconds: z.number(),
      _nanoseconds: z.number(),
    }),
  });

const zSpeaker = () =>
  z.object({
    uid: z.string(),
    displayName: z.string(),
    photoURL: z.string().nullish(),
    bio: z.string().nullish(),
    speakerReferences: z.string().nullish(),
    company: z.string().nullish(),
    twitter: z.string().nullish(),
    github: z.string().nullish(),
  });

async function main() {
  const response = await fetch(process.env.CONFERENCE_HALL ?? "", {
    method: "GET",
  });

  const json = await response.json();

  const talks = z
    .array(zTalk())
    .parse(json.talks)
    .filter((talk) => talk.state === "confirmed");
  const speakers = z
    .array(zSpeaker())
    .parse(json.speakers)
    .filter((speaker) =>
      talks.some((talk) => talk.speakers.includes(speaker.uid))
    );

  for (const talk of talks) {
    const file = Bun.file(
      "./talks/" + slugify(talk.title, { lower: true, strict: true }) + ".mdx"
    );

    await Bun.write(
      file,
      `---
type: conference
title: "${talk.title}"
start: 2023-10-26T08:00:00.000+0100
end: 2023-10-26T09:00:00.000+0100
speakers:
${speakers
  .filter((speaker) => talk.speakers.includes(speaker.uid))
  .map(
    (speaker) =>
      `    - ${slugify(speaker.displayName, { lower: true, strict: true })}`
  )}
room:
rows:
subtitled: false
feedback:
---

${talk.abstract}`
    );
  }

  for (const speaker of speakers) {
    const speakerSlug = slugify(speaker.displayName, {
      lower: true,
      strict: true,
    });

    const extension = speaker.photoURL?.includes("jpg") ? "jpg" : "png";
    const speakerPhoto = speakerSlug + "." + extension;

    if (speaker.photoURL) {
      const image = await fetch(speaker.photoURL);

      if (image.ok) {
        const imageFile = Bun.file("./images/" + speakerPhoto);
        Bun.write(imageFile, await image.blob());
      }
    }

    const file = Bun.file("./speakers/" + speakerSlug + ".mdx");

    await Bun.write(
      file,
      `---
name: ${speaker.displayName}
slug: ${speakerSlug}
image: ${speakerPhoto}
twitter: "${speaker.twitter ?? ""}"
github: "${speaker.github ?? ""}"
company: ${speaker.company ?? ""}
---

${speaker.bio ?? ""}`
    );
  }
}

main();
