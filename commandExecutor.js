// Executes commands from app.js 
export class CommandExecutor {
  constructor() {
    this.commands = []
  }
  
  getDailyLeetCode() {
    const postData = JSON.stringify({
      "query": "query questionOfToday {\n\tactiveDailyCodingChallengeQuestion {\n\t\tdate\n\t\tuserStatus\n\t\tlink\n\t\tquestion {\n\t\t\tacRate\n\t\t\tdifficulty\n\t\t\tfreqBar\n\t\t\tfrontendQuestionId: questionFrontendId\n\t\t\tisFavor\n\t\t\tpaidOnly: isPaidOnly\n\t\t\tstatus\n\t\t\ttitle\n\t\t\ttitleSlug\n\t\t\thasVideoSolution\n\t\t\thasSolution\n\t\t\ttopicTags {\n\t\t\t\tname\n\t\t\t\tid\n\t\t\t\tslug\n\t\t\t}\n\t\t}\n\t}\n}\n",
      "operationName": "questionOfToday"
    });

    const options = {
      hostname: 'leetcode.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  // TODO: populate with logic from /interactions endpoint
}