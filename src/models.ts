export class VoteOption {
  constructor(public name: string) { }
}

export class UserVotes extends Array<string> {
  username: string = ''
  /* istanbul ignore next: super() cannot be covered by istanbul */
  constructor(orderedVoteOptions: string[] = [], username: string = '') {
    super()
    this.username = username
    this.push(...orderedVoteOptions)
  }
}

export class RankedVoteCounts {
  numOptions
  bordaScore: number = 0
  tallyCount: number = 0
  voteCounts: number[] = []

  constructor(numOptions: number) {
    if (numOptions < 0) {
      throw new Error('numOptions must be >= 0')
    }
    this.numOptions = numOptions
    for (let i = 0; i < numOptions; i++) {
      this.voteCounts.push(0)
    }
  }

  addVote(rank: number): void {
    if (rank < 0 || rank >= this.numOptions) {
      throw new Error('vote rank must be >= 0 && < total options')
    }
    this.voteCounts[rank]++
  }
}

export type OptionNameToVoteCountsDict = { [key: string]: RankedVoteCounts }

export type StringNumDict = { [key: string]: number }

export class StageResult {
  userVotes: UserVotes[] = []
  rankedVoteCounts: OptionNameToVoteCountsDict = {}
  bordaScore: number = 0

  constructor(voteOptions: VoteOption[]) {
    for (let voteOption of voteOptions) {
      this.rankedVoteCounts[voteOption.name] = new RankedVoteCounts(voteOptions.length)
    }
  }
}

export class FinalResult {
  totalNumVoters = 0
  stageResults: StageResult[] = []
  winner: string | null = null
  tieOptions: string[] | null = null
}
