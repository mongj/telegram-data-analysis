#!/usr/bin/env python3
"""
Telegram Data Extractor

Extracts analytics data from a Telegram export JSON file using ijson for
memory-efficient streaming parsing. Outputs structured JSON files for
dashboard visualization.

Usage:
    python extract_telegram_data.py [path_to_result.json]

If no path is provided, defaults to './result.json'.
Output files are written to './public/data/'.
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import ijson


def get_word_count(text_field: Any) -> int:
    """Extract word count from a message's text field.

    The text field can be:
    - A string
    - A list of strings/objects (for formatted text)
    """
    if text_field is None:
        return 0
    
    def count_words_in_string(text: str) -> int:
        """Count words in a string by splitting on whitespace."""
        if not text or not text.strip():
            return 0
        return len(text.split())
    
    if isinstance(text_field, str):
        return count_words_in_string(text_field)
    if isinstance(text_field, list):
        total = 0
        for item in text_field:
            if isinstance(item, str):
                total += count_words_in_string(item)
            elif isinstance(item, dict) and "text" in item:
                total += count_words_in_string(item["text"])
        return total
    return 0


def parse_date(date_str: str) -> dict:
    """Parse ISO date string into components."""
    try:
        dt = datetime.fromisoformat(date_str)
        # Get ISO week (year, week number)
        year, week, _ = dt.isocalendar()
        # Calculate Monday of the week (start of week)
        monday = dt - timedelta(days=dt.weekday())
        week_key = f"{monday.year:04d}-{monday.month:02d}-{monday.day:02d}"  # Date of Monday: YYYY-MM-DD
        return {
            "year": dt.year,
            "month": dt.month,
            "day": dt.day,
            "hour": dt.hour,
            "day_of_week": dt.weekday(),  # 0=Monday, 6=Sunday
            "week": week,
            "week_key": week_key,
        }
    except (ValueError, TypeError):
        return {
            "year": None,
            "month": None,
            "day": None,
            "hour": None,
            "day_of_week": None,
            "week": None,
            "week_key": None,
        }


def extract_user_id(file_path: str) -> str:
    """Extract the user's ID from personal_information section."""
    with open(file_path, "rb") as f:
        parser = ijson.parse(f)
        for prefix, event, value in parser:
            if prefix == "personal_information.user_id":
                return f"user{value}"
    return None


def process_telegram_export(file_path: str, output_dir: str):
    """Main processing function that streams through the JSON and extracts data."""

    print("Step 1: Extracting user ID...")
    user_id = extract_user_id(file_path)
    if not user_id:
        print("Warning: Could not find user_id in personal_information")
        user_id = "unknown"
    else:
        print(f"  Found user ID: {user_id}")

    # Data structures for accumulating results
    messages_by_time = []  # List of message records

    chat_summary = {}  # chat_id -> summary dict

    reactions_data = {
        "reactions_given_by_user": defaultdict(
            lambda: defaultdict(int)
        ),  # chat_id -> emoji -> count
        "reactions_received_by_user": defaultdict(
            lambda: defaultdict(int)
        ),  # chat_id -> emoji -> count
        "reactions_by_chat": defaultdict(
            lambda: defaultdict(int)
        ),  # chat_id -> emoji -> count
        "reaction_senders": defaultdict(
            lambda: defaultdict(int)
        ),  # chat_id -> from_name -> count
    }

    time_patterns = {
        "by_hour": defaultdict(
            lambda: {"user": [0] * 24, "others": [0] * 24}
        ),  # chat_id -> hour counts
        "by_day_of_week": defaultdict(
            lambda: {"user": [0] * 7, "others": [0] * 7}
        ),  # chat_id -> dow counts
    }


    # Time series aggregations for efficient dashboard loading
    time_series = {
        "by_day": defaultdict(lambda: defaultdict(lambda: {"user": 0, "others": 0})),
        "by_week": defaultdict(lambda: defaultdict(lambda: {"user": 0, "others": 0})),
        "by_month": defaultdict(lambda: defaultdict(lambda: {"user": 0, "others": 0})),
        "by_year": defaultdict(lambda: defaultdict(lambda: {"user": 0, "others": 0})),
        "totals_by_day": defaultdict(lambda: {"user": 0, "others": 0}),
        "totals_by_week": defaultdict(lambda: {"user": 0, "others": 0}),
        "totals_by_month": defaultdict(lambda: {"user": 0, "others": 0}),
        "totals_by_year": defaultdict(lambda: {"user": 0, "others": 0}),
        # Sender-level aggregations
        "by_sender_day": defaultdict(lambda: defaultdict(int)),  # date -> sender_name -> count
        "by_sender_week": defaultdict(lambda: defaultdict(int)),  # date -> sender_name -> count
        "by_sender_month": defaultdict(lambda: defaultdict(int)),  # date -> sender_name -> count
        "by_sender_year": defaultdict(lambda: defaultdict(int)),  # date -> sender_name -> count
    }

    print("\nStep 2: Processing chats and messages...")

    # Stream through chats
    with open(file_path, "rb") as f:
        # Use ijson to iterate through chats.list items
        chats = ijson.items(f, "chats.list.item")

        chat_count = 0
        total_messages = 0

        for chat in chats:
            chat_count += 1
            chat_id = chat.get("id")
            chat_name = chat.get("name", "Unknown")
            chat_type = chat.get("type", "unknown")

            if chat_count % 50 == 0:
                print(f"  Processed {chat_count} chats, {total_messages} messages...")

            # Initialize chat summary (including insights fields)
            chat_summary[chat_id] = {
                "chat_id": chat_id,
                "chat_name": chat_name,
                "chat_type": chat_type,
                "total_messages": 0,
                "user_messages": 0,
                "other_messages": 0,
                "media_breakdown": defaultdict(int),
                "photo_count": 0,
                "senders": defaultdict(
                    lambda: {
                        "message_count": 0,
                        "media_breakdown": defaultdict(int),
                        "photo_count": 0,
                        "total_text_length": 0,
                        "message_count_with_text": 0,
                    }
                ),
                # Insights fields
                "total_text_length": 0,
                "message_count_for_avg": 0,
                "reply_count": 0,
                "forwarded_count": 0,
                "first_message_date": None,
                "last_message_date": None,
                # New tracking fields
                "active_days": defaultdict(int),  # day_key -> message_count
                "message_dates": [],  # List of datetime objects for gap/streak calculation
            }

            messages = chat.get("messages", [])

            for msg in messages:
                msg_type = msg.get("type")

                # Skip service messages for most analytics
                if msg_type == "service":
                    continue

                total_messages += 1

                date_str = msg.get("date")
                from_id = msg.get("from_id", "")
                from_name = msg.get("from", "Unknown")
                media_type = msg.get("media_type")
                has_photo = "photo" in msg
                text = msg.get("text")
                reactions = msg.get("reactions", [])
                has_reply = "reply_to_message_id" in msg
                is_forwarded = "forwarded_from" in msg

                is_from_user = from_id == user_id

                # Parse date components
                date_parts = parse_date(date_str)

                # 1. Time series data - one record per message
                messages_by_time.append(
                    {
                        "chat_id": chat_id,
                        "chat_name": chat_name,
                        "chat_type": chat_type,
                        "date": date_str,
                        "year": date_parts["year"],
                        "month": date_parts["month"],
                        "day": date_parts["day"],
                        "hour": date_parts["hour"],
                        "day_of_week": date_parts["day_of_week"],
                        "is_from_user": is_from_user,
                        "from_id": from_id,
                        "from_name": from_name,
                        "media_type": media_type,
                        "has_photo": has_photo,
                    }
                )

                # 2. Chat summary
                summary = chat_summary[chat_id]
                summary["total_messages"] += 1
                if is_from_user:
                    summary["user_messages"] += 1
                else:
                    summary["other_messages"] += 1

                if media_type:
                    summary["media_breakdown"][media_type] += 1
                if has_photo:
                    summary["photo_count"] += 1

                # Per-sender breakdown
                sender_key = from_name or from_id or "Unknown"
                if sender_key not in summary["senders"]:
                    summary["senders"][sender_key] = {
                        "from_id": from_id,
                        "message_count": 0,
                        "media_breakdown": defaultdict(int),
                        "photo_count": 0,
                        "total_text_length": 0,
                        "message_count_with_text": 0,
                    }
                summary["senders"][sender_key]["message_count"] += 1
                if media_type:
                    summary["senders"][sender_key]["media_breakdown"][media_type] += 1
                if has_photo:
                    summary["senders"][sender_key]["photo_count"] += 1
                
                # Track word count per sender
                word_count = get_word_count(text)
                if word_count > 0:
                    summary["senders"][sender_key]["total_text_length"] += word_count
                    summary["senders"][sender_key]["message_count_with_text"] += 1

                # 3. Reactions data
                for reaction in reactions:
                    emoji = reaction.get("emoji", "")
                    count = reaction.get("count", 0)
                    recent = reaction.get("recent", [])

                    # Track all reactions in this chat
                    reactions_data["reactions_by_chat"][chat_id][emoji] += count

                    # Check if user gave this reaction (from recent array)
                    for reactor in recent:
                        reactor_id = reactor.get("from_id", "")
                        reactor_name = reactor.get("from", "Unknown")

                        if reactor_id == user_id:
                            reactions_data["reactions_given_by_user"][chat_id][
                                emoji
                            ] += 1

                        # Track who sends reactions
                        reactions_data["reaction_senders"][chat_id][reactor_name] += 1

                    # If this message is from the user, count reactions received
                    if is_from_user:
                        reactions_data["reactions_received_by_user"][chat_id][
                            emoji
                        ] += count

                # 4. Time patterns
                hour = date_parts["hour"]
                dow = date_parts["day_of_week"]

                if hour is not None:
                    if is_from_user:
                        time_patterns["by_hour"][chat_id]["user"][hour] += 1
                    else:
                        time_patterns["by_hour"][chat_id]["others"][hour] += 1

                if dow is not None:
                    if is_from_user:
                        time_patterns["by_day_of_week"][chat_id]["user"][dow] += 1
                    else:
                        time_patterns["by_day_of_week"][chat_id]["others"][dow] += 1

                # 5. Time series aggregations
                if date_parts["year"] is not None:
                    year = date_parts["year"]
                    month = date_parts["month"]
                    day = date_parts["day"]
                    week_key = date_parts.get("week_key")

                    day_key = f"{year:04d}-{month:02d}-{day:02d}"
                    month_key = f"{year:04d}-{month:02d}"
                    year_key = str(year)

                    sender_type = "user" if is_from_user else "others"
                    sender_name = from_name or from_id or "Unknown"

                    # Per-chat aggregations
                    time_series["by_day"][day_key][chat_id][sender_type] += 1
                    if week_key:
                        time_series["by_week"][week_key][chat_id][sender_type] += 1
                    time_series["by_month"][month_key][chat_id][sender_type] += 1
                    time_series["by_year"][year_key][chat_id][sender_type] += 1

                    # Totals across all chats
                    time_series["totals_by_day"][day_key][sender_type] += 1
                    if week_key:
                        time_series["totals_by_week"][week_key][sender_type] += 1
                    time_series["totals_by_month"][month_key][sender_type] += 1
                    time_series["totals_by_year"][year_key][sender_type] += 1

                    # Sender-level aggregations (track all senders)
                    time_series["by_sender_day"][day_key][sender_name] += 1
                    if week_key:
                        time_series["by_sender_week"][week_key][sender_name] += 1
                    time_series["by_sender_month"][month_key][sender_name] += 1
                    time_series["by_sender_year"][year_key][sender_name] += 1

                # 6. Additional insights (tracked in chat_summary)
                summary = chat_summary[chat_id]

                # Word count
                word_count = get_word_count(text)
                if word_count > 0:
                    summary["total_text_length"] += word_count
                    summary["message_count_for_avg"] += 1

                # Reply and forward counts
                if has_reply:
                    summary["reply_count"] += 1
                if is_forwarded:
                    summary["forwarded_count"] += 1

                # First/last message dates and active days tracking
                if date_str:
                    if summary["first_message_date"] is None:
                        summary["first_message_date"] = date_str
                    summary["last_message_date"] = date_str
                    
                    # Track active days for heatmap
                    if date_parts["year"] is not None:
                        day_key = f"{date_parts['year']:04d}-{date_parts['month']:02d}-{date_parts['day']:02d}"
                        summary["active_days"][day_key] += 1
                    
                    # Track message dates for gap/streak calculation
                    try:
                        msg_datetime = datetime.fromisoformat(date_str)
                        summary["message_dates"].append(msg_datetime)
                    except (ValueError, TypeError):
                        pass

        print(f"  Completed: {chat_count} chats, {total_messages} messages")

    # Post-processing: Calculate averages and finalize data structures
    print("\nStep 3: Finalizing data...")

    # Finalize chat summary - convert defaultdicts to regular dicts and calculate insights
    for chat_id, summary in chat_summary.items():
        summary["media_breakdown"] = dict(summary["media_breakdown"])
        senders_dict = {}
        for sender_name, sender_data in summary["senders"].items():
            # Calculate average message length (in words) per sender
            avg_length = 0
            if sender_data["message_count_with_text"] > 0:
                avg_length = round(
                    sender_data["total_text_length"] / sender_data["message_count_with_text"], 2
                )
            
            senders_dict[sender_name] = {
                "from_id": sender_data["from_id"],
                "message_count": sender_data["message_count"],
                "media_breakdown": dict(sender_data["media_breakdown"]),
                "photo_count": sender_data["photo_count"],
                "avg_message_length": avg_length,
            }
        summary["senders"] = senders_dict

        # Calculate insights metrics (avg_message_length is in words)
        if summary["message_count_for_avg"] > 0:
            summary["avg_message_length"] = round(
                summary["total_text_length"] / summary["message_count_for_avg"], 2
            )
        else:
            summary["avg_message_length"] = 0

        # Calculate reply rate
        total = summary["total_messages"]
        if total > 0:
            summary["reply_rate"] = round(summary["reply_count"] / total, 4)
        else:
            summary["reply_rate"] = 0

        # Calculate longest conversation streak and longest gap
        message_dates = sorted(summary["message_dates"])
        longest_streak = 0
        longest_gap_days = 0
        
        if len(message_dates) > 0:
            # Calculate longest streak (consecutive days with messages)
            current_streak = 1
            longest_streak = 1
            
            for i in range(1, len(message_dates)):
                prev_date = message_dates[i-1].date()
                curr_date = message_dates[i].date()
                days_diff = (curr_date - prev_date).days
                
                if days_diff == 0:
                    # Same day, continue streak
                    continue
                elif days_diff == 1:
                    # Consecutive day, increment streak
                    current_streak += 1
                    longest_streak = max(longest_streak, current_streak)
                else:
                    # Gap found, reset streak
                    current_streak = 1
            
            # Calculate longest gap between messages
            for i in range(1, len(message_dates)):
                prev_date = message_dates[i-1].date()
                curr_date = message_dates[i].date()
                days_diff = (curr_date - prev_date).days
                longest_gap_days = max(longest_gap_days, days_diff)
        
        summary["longest_conversation_streak_days"] = longest_streak
        summary["longest_gap_days"] = longest_gap_days
        
        # Convert active_days to regular dict for JSON serialization
        summary["active_days"] = dict(summary["active_days"])
        
        # Calculate activity patterns
        # Note: time_patterns uses integer chat_id keys during processing
        
        # Most active day of week
        if chat_id in time_patterns["by_day_of_week"]:
            dow_counts = time_patterns["by_day_of_week"][chat_id]
            combined_dow = [dow_counts["user"][i] + dow_counts["others"][i] for i in range(7)]
            most_active_dow_idx = combined_dow.index(max(combined_dow)) if combined_dow else None
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            summary["most_active_day_of_week"] = day_names[most_active_dow_idx] if most_active_dow_idx is not None else None
        else:
            summary["most_active_day_of_week"] = None
        
        # Most active hour
        if chat_id in time_patterns["by_hour"]:
            hour_counts = time_patterns["by_hour"][chat_id]
            combined_hours = [hour_counts["user"][i] + hour_counts["others"][i] for i in range(24)]
            most_active_hour = combined_hours.index(max(combined_hours)) if combined_hours else None
            summary["most_active_hour"] = most_active_hour
        else:
            summary["most_active_hour"] = None
        
        # Peak activity period (3-hour window with most messages)
        if chat_id in time_patterns["by_hour"]:
            hour_counts = time_patterns["by_hour"][chat_id]
            combined_hours = [hour_counts["user"][i] + hour_counts["others"][i] for i in range(24)]
            
            # Calculate 3-hour rolling windows (wrapping around midnight)
            max_window_sum = 0
            peak_start = 0
            
            for start_hour in range(24):
                window_sum = sum(combined_hours[(start_hour + i) % 24] for i in range(3))
                if window_sum > max_window_sum:
                    max_window_sum = window_sum
                    peak_start = start_hour
            
            peak_end = (peak_start + 3) % 24
            summary["peak_activity_period"] = {
                "start_hour": peak_start,
                "end_hour": peak_end,
                "message_count": max_window_sum,
            }
        else:
            summary["peak_activity_period"] = None
        
        # Activity trend (increasing/decreasing over time)
        # Compare first half vs second half of messages
        if len(message_dates) >= 4:
            mid_point = len(message_dates) // 2
            first_half_count = mid_point
            second_half_count = len(message_dates) - mid_point
            
            # Calculate messages per day for each half
            if first_half_count > 0 and second_half_count > 0:
                first_date = message_dates[0].date()
                mid_date = message_dates[mid_point].date()
                last_date = message_dates[-1].date()
                
                first_half_days = max(1, (mid_date - first_date).days)
                second_half_days = max(1, (last_date - mid_date).days)
                
                first_half_rate = first_half_count / first_half_days
                second_half_rate = second_half_count / second_half_days
                
                if second_half_rate > first_half_rate * 1.1:
                    summary["activity_trend"] = "increasing"
                elif first_half_rate > second_half_rate * 1.1:
                    summary["activity_trend"] = "decreasing"
                else:
                    summary["activity_trend"] = "stable"
            else:
                summary["activity_trend"] = "stable"
        else:
            summary["activity_trend"] = None
        
        # Clean up intermediate fields
        del summary["total_text_length"]
        del summary["message_count_for_avg"]
        del summary["message_dates"]

    # Finalize reactions data
    reactions_output = {
        "reactions_given_by_user": {
            str(chat_id): dict(emojis)
            for chat_id, emojis in reactions_data["reactions_given_by_user"].items()
        },
        "reactions_received_by_user": {
            str(chat_id): dict(emojis)
            for chat_id, emojis in reactions_data["reactions_received_by_user"].items()
        },
        "reactions_by_chat": {
            str(chat_id): dict(emojis)
            for chat_id, emojis in reactions_data["reactions_by_chat"].items()
        },
        "reaction_senders_by_chat": {
            str(chat_id): dict(senders)
            for chat_id, senders in reactions_data["reaction_senders"].items()
        },
        # Aggregate totals
        "total_reactions_given_by_user": defaultdict(int),
        "total_reactions_received_by_user": defaultdict(int),
        "top_reaction_senders": defaultdict(int),
    }

    # Calculate totals
    for chat_id, emojis in reactions_data["reactions_given_by_user"].items():
        for emoji, count in emojis.items():
            reactions_output["total_reactions_given_by_user"][emoji] += count

    for chat_id, emojis in reactions_data["reactions_received_by_user"].items():
        for emoji, count in emojis.items():
            reactions_output["total_reactions_received_by_user"][emoji] += count

    for chat_id, senders in reactions_data["reaction_senders"].items():
        for sender, count in senders.items():
            reactions_output["top_reaction_senders"][sender] += count

    reactions_output["total_reactions_given_by_user"] = dict(
        reactions_output["total_reactions_given_by_user"]
    )
    reactions_output["total_reactions_received_by_user"] = dict(
        reactions_output["total_reactions_received_by_user"]
    )
    reactions_output["top_reaction_senders"] = dict(
        reactions_output["top_reaction_senders"]
    )

    # Finalize time patterns
    time_patterns_output = {
        "by_hour": {
            str(chat_id): data for chat_id, data in time_patterns["by_hour"].items()
        },
        "by_day_of_week": {
            str(chat_id): data
            for chat_id, data in time_patterns["by_day_of_week"].items()
        },
        # Aggregate totals across all chats
        "total_by_hour": {"user": [0] * 24, "others": [0] * 24},
        "total_by_day_of_week": {"user": [0] * 7, "others": [0] * 7},
    }

    for chat_id, data in time_patterns["by_hour"].items():
        for i in range(24):
            time_patterns_output["total_by_hour"]["user"][i] += data["user"][i]
            time_patterns_output["total_by_hour"]["others"][i] += data["others"][i]

    for chat_id, data in time_patterns["by_day_of_week"].items():
        for i in range(7):
            time_patterns_output["total_by_day_of_week"]["user"][i] += data["user"][i]
            time_patterns_output["total_by_day_of_week"]["others"][i] += data["others"][
                i
            ]

    # Finalize time series aggregations
    time_series_output = {
        "by_day": {
            date_key: {str(chat_id): dict(counts) for chat_id, counts in chats.items()}
            for date_key, chats in time_series["by_day"].items()
        },
        "by_week": {
            date_key: {str(chat_id): dict(counts) for chat_id, counts in chats.items()}
            for date_key, chats in time_series["by_week"].items()
        },
        "by_month": {
            date_key: {str(chat_id): dict(counts) for chat_id, counts in chats.items()}
            for date_key, chats in time_series["by_month"].items()
        },
        "by_year": {
            date_key: {str(chat_id): dict(counts) for chat_id, counts in chats.items()}
            for date_key, chats in time_series["by_year"].items()
        },
        "totals_by_day": {
            date_key: dict(counts)
            for date_key, counts in time_series["totals_by_day"].items()
        },
        "totals_by_week": {
            date_key: dict(counts)
            for date_key, counts in time_series["totals_by_week"].items()
        },
        "totals_by_month": {
            date_key: dict(counts)
            for date_key, counts in time_series["totals_by_month"].items()
        },
        "totals_by_year": {
            date_key: dict(counts)
            for date_key, counts in time_series["totals_by_year"].items()
        },
        # Sender-level aggregations
        "by_sender_day": {
            date_key: dict(senders)
            for date_key, senders in time_series["by_sender_day"].items()
        },
        "by_sender_week": {
            date_key: dict(senders)
            for date_key, senders in time_series["by_sender_week"].items()
        },
        "by_sender_month": {
            date_key: dict(senders)
            for date_key, senders in time_series["by_sender_month"].items()
        },
        "by_sender_year": {
            date_key: dict(senders)
            for date_key, senders in time_series["by_sender_year"].items()
        },
    }

    # Precompute all chats per time segment (by user messages only, sorted descending)
    print("\nStep 3.5: Computing chats per time segment...")
    top_chats_over_time = {
        "by_day": {},
        "by_week": {},
        "by_month": {},
        "by_year": {},
    }

    # Create a map of chat_id to chat_name for quick lookup
    chat_id_to_name = {
        str(chat_id): summary["chat_name"]
        for chat_id, summary in chat_summary.items()
    }

    for granularity in ["day", "week", "month", "year"]:
        source = time_series[f"by_{granularity}"]
        output = top_chats_over_time[f"by_{granularity}"]

        for date_key, chats_data in source.items():
            # Get all chats with user message counts for this date
            chats_with_counts = []
            for chat_id_str, counts in chats_data.items():
                user_count = counts.get("user", 0)
                if user_count > 0:
                    chats_with_counts.append({
                        "chat_id": chat_id_str,
                        "chat_name": chat_id_to_name.get(chat_id_str, "Unknown"),
                        "user_messages": user_count,
                    })

            # Sort by user_messages descending (keep all chats, not just top 10)
            chats_with_counts.sort(key=lambda x: x["user_messages"], reverse=True)

            # Store as a dict for easy lookup: { chat_id: user_messages }
            # Keep all chats, sorted by user_messages descending
            output[date_key] = {
                item["chat_id"]: item["user_messages"] for item in chats_with_counts
            }

    # Write output files
    print("\nStep 4: Writing output files...")

    # 1. Messages by time
    output_path = os.path.join(output_dir, "messages_by_time.json")
    print(f"  Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(messages_by_time, f, ensure_ascii=False)
    print(f"    -> {len(messages_by_time)} message records")

    # 2. Chat summary
    output_path = os.path.join(output_dir, "chat_summary.json")
    print(f"  Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(list(chat_summary.values()), f, indent=2, ensure_ascii=False)
    print(f"    -> {len(chat_summary)} chats")

    # 3. Reactions summary
    output_path = os.path.join(output_dir, "reactions_summary.json")
    print(f"  Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(reactions_output, f, indent=2, ensure_ascii=False)

    # 4. Time patterns
    output_path = os.path.join(output_dir, "time_patterns.json")
    print(f"  Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(time_patterns_output, f, indent=2, ensure_ascii=False)

    # 5. Time series aggregated
    output_path = os.path.join(output_dir, "time_series_aggregated.json")
    print(f"  Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(time_series_output, f, ensure_ascii=False)

    # 6. Top chats over time (preprocessed)
    output_path = os.path.join(output_dir, "top_chats_over_time.json")
    print(f"  Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(top_chats_over_time, f, ensure_ascii=False)
    total_segments = (
        len(top_chats_over_time["by_day"])
        + len(top_chats_over_time["by_week"])
        + len(top_chats_over_time["by_month"])
        + len(top_chats_over_time["by_year"])
    )
    print(f"    -> {total_segments} time segments processed (all chats included, sorted)")

    print("\nDone! Output files created:")
    print("  - messages_by_time.json")
    print("  - chat_summary.json")
    print("  - reactions_summary.json")
    print("  - time_patterns.json")
    print("  - time_series_aggregated.json")
    print("  - top_chats_over_time.json")


def main():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = "./result.json"

    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    output_dir = "./public/data"
    os.makedirs(output_dir, exist_ok=True)

    print("Telegram Data Extractor")
    print("=======================")
    print(f"Input file: {file_path}")
    print(f"Output directory: {output_dir}")
    print()

    process_telegram_export(file_path, output_dir)


if __name__ == "__main__":
    main()
