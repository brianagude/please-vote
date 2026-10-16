// Each person's full vote list, by topic, as a separate file. Their page shows the totals and topics
// right away and loads this only when someone opens a topic, so long records (thousands of votes)
// don't make the page slow.
import type { APIRoute } from "astro";
import { loadVotes, personPages } from "../../../lib/state";
import { voteTopics } from "../../../lib/votes";

export function getStaticPaths() {
  return personPages()
    .filter(({ c }) => c.record?.votes)
    .map(({ c, code }) => ({ params: { id: c.id }, props: { code } }));
}

export const GET: APIRoute = ({ params, props }) => {
  const v = loadVotes(props.code as string, params.id!)!;
  // One row per vote: [date, chamber, kind of vote, bill, title, url, passed (1/0), became law (1/0), their vote]
  const topics = voteTopics(v.votes).map(([topic, list]) => [
    topic,
    list.map((x) => [x.date, x.chamber, x.what, x.bill, x.title, x.url, x.passed ? 1 : 0, x.law ? 1 : 0, x.vote]),
  ]);
  return new Response(JSON.stringify({ topics }), { headers: { "content-type": "application/json" } });
};
