/**
 * Research notes shown on the opening loader.
 *
 * Every figure here was checked against the cited source's own page or abstract.
 * If you add a fact, check the number against the source and keep the wording
 * to what that source actually reports (for example, a prevalence is not a
 * count of predictors, and a pooled estimate is not a diagnosis rate for any one person).
 */

export type ResearchFact = {
  id: string;
  /** The claim, in our own words. */
  text: string;
  /** Reference in APA-style, shown as the link text. */
  citation: string;
  url: string;
};

export const RESEARCH_FACTS: ResearchFact[] = [
  {
    id: 'beck-2001',
    text:
      'A meta-analysis of 84 studies from the 1990s identified 13 significant predictors of postpartum depression. ' +
      'Among the strongest were depression and anxiety during pregnancy, low self-esteem, and childcare stress.',
    citation:
      'Beck, C. T. (2001). Predictors of postpartum depression: An update. Nursing Research, 50(5), 275–285.',
    url: 'https://www.ovid.com/jnls/nursingresearchonline/abstract/00006199-200109000-00004~predictors-of-postpartum-depression-an-update?redirectionsource=fulltextview',
  },
  {
    id: 'ohara-swain-1996',
    text:
      'Across many studies, non-psychotic postpartum depression has an average prevalence of about 13%, or roughly 1 in 8 new mothers. ' +
      'Estimates run higher when self-report scales are used and when the postpartum period measured is longer.',
    citation:
      'O’Hara, M. W., & Swain, A. M. (1996). Rates and risk of postpartum depression—a meta-analysis. International Review of Psychiatry, 8(1), 37–54.',
    url: 'https://doi.org/10.3109/09540269609037816',
  },
  {
    id: 'who-perinatal',
    text:
      'The World Health Organization estimates that about 13% of women who have just given birth, and about 10% of pregnant women, ' +
      'experience a mental disorder worldwide, mainly depression.',
    citation: 'World Health Organization. Perinatal mental health.',
    url: 'https://www.who.int/teams/mental-health-and-substance-use/promotion-prevention/maternal-mental-health',
  },
  {
    id: 'wang-2021',
    text:
      'Pooling 565 studies from 80 countries and regions and more than 1.2 million women, researchers estimated global postpartum depression ' +
      'prevalence at 17.22%, with significantly lower rates in high-income countries.',
    citation:
      'Wang, Z., Liu, J., Shuai, H., et al. (2021). Mapping global prevalence of depression among postpartum women. Translational Psychiatry, 11, 543.',
    url: 'https://link.springer.com/article/10.1038/s41398-021-01663-6',
  },
  {
    id: 'upadhyay-2017',
    text:
      'A meta-analysis of 38 studies covering 20,043 women in India estimated the pooled prevalence of postpartum depression at 22%.',
    citation:
      'Upadhyay, R. P., et al. (2017). Postpartum depression in India: a systematic review and meta-analysis. Bulletin of the World Health Organization, 95(10), 706–717C.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5689195',
  },
  {
    id: 'paulson-2010',
    text:
      'Fathers are affected too. A JAMA meta-analysis of 43 studies and 28,004 participants estimated that about 10.4% of fathers ' +
      'have depression before or after the birth, and that it moderately correlates with the mother’s depression.',
    citation:
      'Paulson, J. F., & Bazemore, S. D. (2010). Prenatal and postpartum depression in fathers and its association with maternal depression: a meta-analysis. JAMA, 303(19), 1961–1969.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20483973/',
  },
];

export function pickRandomFact(): ResearchFact {
  return RESEARCH_FACTS[Math.floor(Math.random() * RESEARCH_FACTS.length)];
}
