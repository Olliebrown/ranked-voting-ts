import { StringNumDict, OptionNameToVoteCountsDict, StageResult, UserVotes, VoteOption } from './models'

export class VoteControllerLogic {

  constructor(public options: VoteOption[], public useBordaScore: number = 0, public useTally: boolean = false) {
    if (!options || options.length <= 0) {
      throw new Error('options are required')
    }

    if (useBordaScore > 0 && useTally) {
      throw new Error('useBordaScore and useTally cannot both be enabled')
    }
  }

  // This comparison method only works here because we're operating
  // on arrays where options only ever appear once
  sameOptions(optionsA: string[], optionsB: string[]) {
    return optionsA.length === optionsB.length && optionsA.every(val => optionsB.includes(val))
  }

  getNextStageResult(currentStageResult: StageResult, losers: string[]): StageResult {
    if (!losers || losers.length === 0) {
      throw new Error('losers must be passed to generate the next StageResult')
    }

    let nextUserVotes: UserVotes[] = []

    for (let userVotes of currentStageResult.userVotes) {
      let votesWithoutLosers = new UserVotes(userVotes.filter(option => !losers.includes(option)), userVotes.username)
      nextUserVotes.push(votesWithoutLosers)
    }

    let nextStageResult = this.getStageResult(nextUserVotes)

    return nextStageResult
  }

  getOptionsWithRankOneVotes(optionNameToVoteCountsDict: OptionNameToVoteCountsDict): string[] {
    return Object.keys(optionNameToVoteCountsDict)
      .filter(key => optionNameToVoteCountsDict[key].voteCounts[0] > 0)
      .map(key => key)
  }

  getLosers(currentStageResult: StageResult): string[] {
    let losers: string[] = []
    let allVoteCounts = currentStageResult.rankedVoteCounts

    let fewestRankOneVotes: number | null = null
    let lowestBordaScore: number | null = null
    let lowestTally: number | null = null

    for (let optionName in allVoteCounts) {
      if (!this.optionHasVotes(optionName, allVoteCounts)) {
        continue
      }
      let rankOneVotes = allVoteCounts[optionName].voteCounts[0]
      if (fewestRankOneVotes === null || rankOneVotes < fewestRankOneVotes) {
        fewestRankOneVotes = rankOneVotes
      }

      let bordaScore = allVoteCounts[optionName].bordaScore
      if (lowestBordaScore === null || bordaScore < lowestBordaScore) {
        lowestBordaScore = bordaScore
      }

      let tallyCount = allVoteCounts[optionName].tallyCount
      if (lowestTally === null || tallyCount < lowestTally) {
        lowestTally = tallyCount
      }
    }

    for (let optionName in allVoteCounts) {
      if (this.useBordaScore > 0) {
        if (allVoteCounts[optionName].bordaScore === lowestBordaScore) {
          losers.push(optionName)
        }
      } else if (this.useTally) {
        if (allVoteCounts[optionName].tallyCount === lowestTally) {
          losers.push(optionName)
        }
      } else {
        if (allVoteCounts[optionName].voteCounts[0] === fewestRankOneVotes) {
          losers.push(optionName)
        }
      }
    }

    let numTiedLosers = losers.length
    let numOptionsLeftWithRankOneVotes = this.getOptionsWithRankOneVotes(currentStageResult.rankedVoteCounts).length

    // Tie breaker logic only required if tie is between all remaining viable options
    if (numTiedLosers === 1 || numTiedLosers !== numOptionsLeftWithRankOneVotes) {
      return losers
    }

    let eliminationScenarioCounts: StringNumDict = {}
    for (let loser of losers) {
      eliminationScenarioCounts[loser] = 0
    }

    for (let loser of losers) {
      let nextStageResultWithoutLoser = this.getNextStageResult(currentStageResult, [loser])
      for (let optionName in nextStageResultWithoutLoser.rankedVoteCounts) {
        if (!losers.includes(optionName)) {
          continue
        }
        let rankOneVotes = nextStageResultWithoutLoser.rankedVoteCounts[optionName].voteCounts[0]
        eliminationScenarioCounts[optionName] += rankOneVotes
      }
    }

    fewestRankOneVotes = Math.min(...Object.values(eliminationScenarioCounts))

    let worstLosers = Object.keys(eliminationScenarioCounts)
      .filter(key => eliminationScenarioCounts[key] == fewestRankOneVotes)
      .map(key => key)

    return worstLosers
  }

  getRankOneVotesDict(voteCounts: OptionNameToVoteCountsDict): StringNumDict {
    let dict: StringNumDict = {}

    for (let optionName in voteCounts) {
      dict[optionName] = voteCounts[optionName].voteCounts[0]
    }

    return dict
  }

  optionHasVotes(optionName: string, allVoteCounts: OptionNameToVoteCountsDict): boolean {
    let voteCounts = allVoteCounts[optionName]
    for (let count of voteCounts.voteCounts) {
      if (count > 0) {
        return true
      }
    }
    return false
  }

  getStageResult(userVotesArray: UserVotes[]): StageResult {
    let stageResult = new StageResult(this.options)

    for (let userVotes of userVotesArray) {
      for (let i = 0; i < userVotes.length; i++) {
        stageResult.rankedVoteCounts[userVotes[i]].addVote(i)
      }
    }

    for (let option in stageResult.rankedVoteCounts) {
      let voteCounts = stageResult.rankedVoteCounts[option].voteCounts
      let bordaScore = 0
      let tallyCount = 0
      for (let i = 0; i < voteCounts.length; i++) {
        bordaScore += voteCounts[i] * (this.useBordaScore - i)
        tallyCount += voteCounts[i]
      }
      stageResult.rankedVoteCounts[option].bordaScore = bordaScore
      stageResult.rankedVoteCounts[option].tallyCount = tallyCount
    }

    stageResult.userVotes = userVotesArray.map(v => { return new UserVotes([...v], v.username) })
    return stageResult
  }

  getStageWinner(stageResult: StageResult): string | null {
    let totalScore = 0

    if (this.useBordaScore > 0) {
      for (let option in stageResult.rankedVoteCounts) {
        totalScore += stageResult.rankedVoteCounts[option].bordaScore
      }

      for (let option in stageResult.rankedVoteCounts) {
        let percentage = stageResult.rankedVoteCounts[option].bordaScore / totalScore
        if (percentage > 0.5) {
          return option
        }
      }
    } else if (this.useTally) {
      for (let option in stageResult.rankedVoteCounts) {
        totalScore += stageResult.rankedVoteCounts[option].tallyCount
      }

      for (let option in stageResult.rankedVoteCounts) {
        let percentage = stageResult.rankedVoteCounts[option].tallyCount / totalScore
        if (percentage > 0.5) {
          return option
        }
      }
    } else {
      for (let option in stageResult.rankedVoteCounts) {
        totalScore += stageResult.rankedVoteCounts[option].voteCounts[0]
      }

      for (let option in stageResult.rankedVoteCounts) {
        let percentage = stageResult.rankedVoteCounts[option].voteCounts[0] / totalScore
        if (percentage > 0.5) {
          return option
        }
      }
    }

    return null
  }
}
