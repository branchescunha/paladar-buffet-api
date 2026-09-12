ALTER TABLE "Proposal" DROP CONSTRAINT "Proposal_eventId_fkey";

ALTER TABLE "Proposal"
ADD CONSTRAINT "Proposal_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
