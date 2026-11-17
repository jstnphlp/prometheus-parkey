import { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Icon } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'

const topics = [
  {
    title: 'What is Parkey?',
    answer:
      'Parkey helps drivers find and compare sourced parking information. Browsing is available without an account.',
    category: 'General',
  },
  {
    title: 'Are parking rates confirmed?',
    answer:
      'Rates and hours reflect recorded sources. They may be missing, outdated or conflicting. Check current posted signs and the parking operator.',
    category: 'Parking',
  },
  {
    title: 'Can I reserve a parking spot?',
    answer:
      'Parkey V1 is for discovery. Reservations, payments and guaranteed spaces are not available.',
    category: 'Parking',
  },
  {
    title: 'How do I get directions?',
    answer:
      'Open parking details and choose Get Direction. A current reviewed entrance, visitor access, operator authorization and your directions consent are required.',
    category: 'Navigation',
  },
  {
    title: 'How do I close my Parkey account?',
    answer:
      'Account deletion is not enabled in this version. Guest discovery does not create an account. Signing out does not delete an account or local saved places.',
    category: 'Account',
  },
  {
    title: 'Do I need an account?',
    answer:
      'No. Explore, search, saved parking and directions are available without registration.',
    category: 'Account',
  },
  {
    title: 'Can I search without location access?',
    answer:
      'Yes. Enter a destination manually. Location is optional; enable it only when you want to recenter or navigate.',
    category: 'Navigation',
  },
  {
    title: 'How do I report a correction?',
    answer:
      'Open parking details and save a local correction draft. Sending for private review requires the separately enabled report service and your explicit consent. Sending never publishes or verifies parking.',
    category: 'Parking',
  },
]

export function HelpCenter() {
  const styles = useStyles()
  const { colors } = useTheme()
  const [tab, setTab] = useState('FAQ')
  const [category, setCategory] = useState('General')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>('What is Parkey?')
  const results = topics.filter(
    (topic) =>
      (category === 'General' || topic.category === category) &&
      `${topic.title} ${topic.answer}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  )
  return (
    <View style={styles.content}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {['FAQ', 'Contact us'].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === tab }}
            onPress={() => setTab(value)}
            style={[
              styles.tab,
              tab === value && { borderBottomColor: colors.navigationActive },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                tab === value && { color: colors.navigationActive },
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'FAQ' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {['General', 'Parking', 'Account', 'Navigation'].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: category === value }}
                onPress={() => setCategory(value)}
                style={[
                  styles.category,
                  value === category && {
                    backgroundColor: colors.brand,
                    borderColor: colors.brand,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    value === category && { color: colors.onAction },
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.search}>
            <Icon name="search" size={20} color={colors.muted} />
            <TextInput
              accessibilityLabel="Search help topics"
              value={query}
              onChangeText={setQuery}
              placeholder="Search help topics"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>
          {results.map((topic) => (
            <View key={topic.title} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={topic.title}
                accessibilityState={{ expanded: expanded === topic.title }}
                onPress={() =>
                  setExpanded(expanded === topic.title ? null : topic.title)
                }
                style={styles.question}
              >
                <Text style={styles.questionText}>{topic.title}</Text>
                <Icon
                  name="chevron"
                  size={16}
                  color={colors.navigationActive}
                />
              </Pressable>
              {expanded === topic.title ? (
                <Text style={styles.answer}>{topic.answer}</Text>
              ) : null}
            </View>
          ))}
          {!results.length ? (
            <Text style={styles.answer}>
              No matching help topics. Try a different word.
            </Text>
          ) : null}
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.questionText}>
            Support contact is not available yet
          </Text>
          <Text style={styles.answer}>
            For parking data corrections, open the location’s details and choose
            Suggest a correction. Drafts stay on your device unless you
            explicitly send them through an enabled private review service.
          </Text>
        </View>
      )}
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    content: { gap: 16 },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 8,
    },
    tab: {
      flex: 1,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabText: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 24,
      color: colors.muted,
    },
    categories: { gap: 7, paddingBottom: 0 },
    category: {
      minHeight: 40,
      minWidth: 94,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 16,
    },
    categoryText: {
      fontFamily: fonts.semibold,
      fontSize: 12,
      lineHeight: 18,
      color: colors.ink,
    },
    search: {
      minHeight: 61,
      backgroundColor: colors.surface,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingHorizontal: 24,
      marginBottom: 10,
    },
    input: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink,
      paddingVertical: 16,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.canvas,
    },
    question: {
      minHeight: 57,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    questionText: {
      flex: 1,
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 21,
      color: colors.ink,
    },
    answer: {
      fontFamily: fonts.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.muted,
      paddingTop: 20,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  }),
)
